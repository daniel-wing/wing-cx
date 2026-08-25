/* Scribe — UI glue. Picks a runtime, decodes the file to 16 kHz mono,
   hands it to the worker, and turns the result into text + SRT. */

const $ = (id) => document.getElementById(id);

/** Shorthand for the shared translator; falls back to the key if unloaded. */
const t = (key, vars) => (window.wingT ? window.wingT(key, vars) : key);

const el = {
  dropzone: $('dropzone'),
  fileInput: $('file-input'),
  filePanel: $('file-panel'),
  fileName: $('file-name'),
  fileMeta: $('file-meta'),
  clearFile: $('clear-file'),
  videoPreview: $('video-preview'),
  audioPreview: $('audio-preview'),
  runBtn: $('run-btn'),
  cancelBtn: $('cancel-btn'),
  progressWrap: $('progress-wrap'),
  progressLabel: $('progress-label'),
  progressPct: $('progress-pct'),
  progressTrack: $('progress-track'),
  progressBar: $('progress-bar'),
  progressNote: $('progress-note'),
  estimate: $('estimate'),
  errorBox: $('error-box'),
  advice: $('advice-box'),
  mobileNote: $('mobile-note'),
  outputPanel: $('output-panel'),
  doneNote: $('done-note'),
  langCheck: $('lang-check'),
  transcript: $('transcript'),
  copyBtn: $('copy-btn'),
  dlTxt: $('dl-txt'),
  dlSrt: $('dl-srt'),
  model: $('model'),
  language: $('language'),
  runtimeBadge: $('runtime-badge'),
  runtimeText: $('runtime-text'),
  engineHint: $('engine-hint'),
};

// Approximate one-time download per model, per runtime (encoder + decoder).
const MODEL_MB = {
  'onnx-community/whisper-tiny':  { webgpu: 114, wasm: 39 },
  'onnx-community/whisper-base':  { webgpu: 197, wasm: 73 },
  'onnx-community/whisper-small': { webgpu: 559, wasm: 238 },
};

/**
 * Wall-clock seconds spent per second of audio, measured on dense continuous
 * speech (a lecture recording) rather than short clips — short clips finish
 * disproportionately fast and make these look better than they are.
 *
 * Only ever a starting guess: once the first segment lands, the UI switches to
 * an estimate measured on the visitor's own machine.
 */
const SPEED = {
  'onnx-community/whisper-tiny':  { webgpu: 0.25, wasm: 0.55 },
  'onnx-community/whisper-base':  { webgpu: 0.43, wasm: 0.75 },
  // Not a typo: on a GPU, small beats base on wall time. Bigger models loop and
  // hallucinate less, so they emit fewer tokens per window. Its WASM figure is
  // extrapolated rather than measured.
  'onnx-community/whisper-small': { webgpu: 0.33, wasm: 2.00 },
};

const state = {
  file: null,
  isMobile: false,
  device: 'wasm',
  duration: null,
  detected: null,
  firstChunkMs: 0,
  running: false,
  objectUrl: null,
  txt: '',
  srt: '',
  view: 'txt',
};

let worker = null;

/* ---------------- device and memory headroom ---------------- */

/**
 * Decoding costs about 64 KB per second of audio per channel. At peak we are
 * briefly holding the source file, the decoded AudioBuffer (assume stereo) and
 * our mono copy at once, which is what actually kills a tab on a phone.
 */
const BYTES_PER_AUDIO_SECOND = 16000 * 4;

function isMobileDevice() {
  const uaData = navigator.userAgentData;
  if (typeof uaData?.mobile === 'boolean') return uaData.mobile;
  // iPadOS claims to be a Mac, so touch points are the giveaway.
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  if (/Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent)) return true;
  return window.matchMedia('(pointer: coarse)').matches && window.screen.width < 1024;
}

/** How much working memory this device can plausibly give one tab. */
function memoryBudgetBytes() {
  const MB = 1024 * 1024;
  // Calibrated against an observed failure rather than guessed: an iPhone
  // running iOS 26 crashed Safari while building a session for the base model
  // on WebGPU, whose weights alone come to about 400 MB once allocated. So the
  // real ceiling sits below that. iOS kills the tab outright rather than
  // raising anything catchable, which is why this has to be predicted up front.
  if (state.isMobile) return 400 * MB;
  const gb = navigator.deviceMemory;
  if (gb && gb <= 4) return 900 * MB;
  return 1500 * MB;
}

/**
 * The model dominates, and it costs the same whether the recording is two
 * minutes or two hours. Leaving it out of this sum is what let a 2 minute clip
 * be declared fine on an iPhone and then crash the tab while building the
 * inference session. Weights need roughly double their size once the runtime
 * has its arena and buffers allocated.
 */
function modelBytes() {
  const mb = MODEL_MB[el.model.value]?.[state.device] ?? 197;
  return mb * 1024 * 1024 * 2;
}

function estimatePeakBytes(fileBytes, durationSeconds) {
  const audio = (durationSeconds || 0) * BYTES_PER_AUDIO_SECOND * 3;
  return fileBytes + audio + modelBytes();
}

/**
 * Advice, never a block. The estimate is approximate and the person in front of
 * the screen knows their machine better than we do, so a long file still runs
 * if they ask for it.
 */
function sizeAdvice(fileBytes, durationSeconds) {
  const peak = estimatePeakBytes(fileBytes, durationSeconds);
  const budget = memoryBudgetBytes();
  if (peak < budget * 0.7) return null;

  const where = t(state.isMobile ? 'scribe.advice.where.phone' : 'scribe.advice.where.tab');
  const level = peak > budget ? 'high' : 'medium';

  // Say which half is the problem, because the fix differs. A heavy model is
  // fixed by picking a smaller one; a long recording is not.
  const modelHeavy = modelBytes() > (peak - modelBytes());
  const cause = modelHeavy
    ? t('scribe.advice.cause.model', {
        model: el.model.selectedOptions[0].textContent.split('—')[0].trim(),
      })
    : t('scribe.advice.cause.length');

  const lead = t(level === 'high' ? 'scribe.advice.lead.high' : 'scribe.advice.lead.medium', { where });

  return { level, html: `<strong>${lead}</strong> ${cause} ${t('scribe.advice.body')}` };
}

/** Re-run the advice whenever anything feeding it changes. */
function refreshAdvice() {
  if (!state.file) {
    showAdvice(null);
    return;
  }
  showAdvice(sizeAdvice(state.file.size, state.duration));
}

/* ---------------- runtime detection ---------------- */

async function detectRuntime() {
  // Phones deliberately never take the WebGPU path, even when they advertise
  // it. An iPhone on iOS 26 reported WebGPU and then killed the tab while
  // building the inference session, first with base (199 MB) and again with
  // tiny (117 MB). Halving the weights changed nothing, so the ceiling is not
  // the model: Safari's WebGPU limits are, and exceeding them takes the whole
  // renderer down rather than raising something catchable. WASM is slower and
  // finishes.
  if (!state.isMobile && navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) state.device = 'webgpu';
    } catch { /* fall through to WASM */ }
  }

  const fast = state.device === 'webgpu';
  el.runtimeBadge.classList.toggle('is-fast', fast);

  el.runtimeText.textContent = fast
    ? 'WebGPU'
    : t(state.isMobile ? 'scribe.runtime.cpuMobile' : 'scribe.runtime.cpu');

  el.engineHint.textContent = t(
    fast ? 'scribe.hint.gpu' : state.isMobile ? 'scribe.hint.mobile' : 'scribe.hint.cpu'
  );

  // Now that we know the runtime, show download sizes that are actually true.
  for (const option of el.model.options) {
    const spec = MODEL_MB[option.value];
    if (spec) option.textContent = `${t(option.dataset.modelLabel)} (~${spec[state.device]} MB)`;
  }

  // Phones cannot hold the base model. Choose one that fits before the person
  // has any chance to press Generate and lose the tab.
  if (state.isMobile && el.model.querySelector('option[value$="whisper-tiny"]')) {
    el.model.value = 'onnx-community/whisper-tiny';
  }

  updateEstimate();

  if (state.isMobile) {
    // Only phones get told this. On a laptop it is noise.
    const mb = MODEL_MB[el.model.value]?.[state.device] ?? 197;
    el.mobileNote.innerHTML = t('scribe.mobileNote', { mb });
    el.mobileNote.classList.remove('hidden');
  }
}

/** Round a duration to something a human would actually say out loud. */
function roughDuration(seconds) {
  if (seconds < 45) return 'well under a minute';
  if (seconds < 90) return 'about a minute';
  if (seconds < 60 * 60) return `about ${Math.round(seconds / 60)} min`;
  const hours = seconds / 3600;
  return `about ${hours.toFixed(1)} hr`;
}

/** Phrasing for the time-remaining line, which reads as a full sentence. */
function remainingText(seconds) {
  if (seconds < 20) return t('scribe.left.almost');
  if (seconds < 50) return t('scribe.left.under');
  if (seconds < 90) return t('scribe.left.about1');
  if (seconds < 60 * 60) return t('scribe.left.min', { n: Math.round(seconds / 60) });
  return t('scribe.left.hr', { n: (seconds / 3600).toFixed(1) });
}

/**
 * Up-front guess, shown before anything starts. Deliberately a range: the
 * numbers in SPEED come from one fast laptop, and a slower machine can easily
 * take twice as long. Once transcription starts this is replaced by a figure
 * measured on the visitor's own hardware.
 */
function updateEstimate() {
  const ratio = SPEED[el.model.value]?.[state.device];
  if (!state.duration || !Number.isFinite(state.duration) || !ratio) {
    el.estimate.textContent = '';
    return;
  }

  const low = state.duration * ratio;
  const high = low * 2;

  if (high < 60) {
    el.estimate.textContent = t('scribe.est.under');
    return;
  }

  const lowMin = Math.max(1, Math.round(low / 60));
  const highMin = Math.max(lowMin + 1, Math.round(high / 60));
  el.estimate.textContent = t('scribe.est.range', { low: lowMin, high: highMin });
}

/**
 * Human-readable language name in whichever language the page is showing.
 * Intl.DisplayNames already knows all of these, so there is nothing to
 * translate by hand, and it gets the casing convention right per locale
 * (English capitalises language names, Spanish does not).
 */
function languageName(code) {
  if (!code) return '';
  try {
    const name = new Intl.DisplayNames([window.WING_LANG || 'en'], { type: 'language' }).of(code);
    if (name && name !== code) return name;
  } catch { /* fall back to the picker below */ }

  for (const option of el.language.options) {
    if (option.value === code) return option.textContent.split('—')[0].trim();
  }
  return code.toUpperCase();
}

/* ---------------- helpers ---------------- */

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDuration(seconds) {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function srtTimestamp(seconds) {
  const t = Math.max(0, seconds || 0);
  const whole = Math.floor(t);
  const h = String(Math.floor(whole / 3600)).padStart(2, '0');
  const m = String(Math.floor((whole % 3600) / 60)).padStart(2, '0');
  const s = String(whole % 60).padStart(2, '0');
  const ms = String(Math.floor((t - whole) * 1000)).padStart(3, '0');
  return `${h}:${m}:${s},${ms}`;
}

function buildSrt(chunks) {
  const cues = [];
  chunks.forEach((chunk, i) => {
    const text = (chunk.text || '').trim();
    if (!text) return;
    const [rawStart, rawEnd] = chunk.timestamp || [];
    const start = rawStart ?? 0;
    // Whisper leaves the final cue open-ended; give it a sensible tail.
    const end = rawEnd ?? start + 2;
    cues.push(`${cues.length + 1}\n${srtTimestamp(start)} --> ${srtTimestamp(end)}\n${text}\n`);
  });
  return cues.join('\n');
}

function showError(html) {
  el.errorBox.innerHTML = html;
  el.errorBox.classList.remove('hidden');
}

function showAdvice(advice) {
  if (!advice) {
    el.advice.classList.add('hidden');
    el.advice.innerHTML = '';
    return;
  }
  el.advice.innerHTML = advice.html;
  el.advice.classList.toggle('is-high', advice.level === 'high');
  el.advice.classList.remove('hidden');
}

function clearError() {
  el.errorBox.classList.add('hidden');
  el.errorBox.textContent = '';
}

function baseName(name) {
  return name.replace(/\.[^./\\]+$/, '') || 'transcript';
}

function download(text, filename, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------- audio decoding ---------------- */

async function decodeToMono16k(file) {
  const buffer = await file.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error('This browser has no Web Audio support.');

  // Asking for a 16 kHz context makes decodeAudioData resample for us,
  // which is exactly the rate Whisper expects.
  const ctx = new Ctx({ sampleRate: 16000 });
  try {
    const decoded = await new Promise((resolve, reject) => {
      const maybePromise = ctx.decodeAudioData(buffer, resolve, reject);
      if (maybePromise?.then) maybePromise.then(resolve, reject);
    });

    let samples;
    if (decoded.numberOfChannels === 1) {
      samples = decoded.getChannelData(0);
    } else {
      const left = decoded.getChannelData(0);
      const right = decoded.getChannelData(1);
      samples = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) samples[i] = (left[i] + right[i]) / 2;
    }

    // Copy off the AudioBuffer so we can transfer ownership to the worker.
    return { audio: new Float32Array(samples), duration: decoded.duration };
  } finally {
    ctx.close();
  }
}

/* ---------------- file handling ---------------- */

function setFile(file) {
  if (!file) return;

  clearError();
  showAdvice(null);
  resetOutput();
  releasePreview();

  state.file = file;
  state.duration = null;
  el.estimate.textContent = '';
  el.fileName.textContent = file.name;
  el.fileMeta.textContent = formatBytes(file.size);
  el.filePanel.classList.remove('hidden');

  state.objectUrl = URL.createObjectURL(file);
  const isAudio = file.type.startsWith('audio/');
  const preview = isAudio ? el.audioPreview : el.videoPreview;
  const other = isAudio ? el.videoPreview : el.audioPreview;

  other.classList.add('hidden');
  other.removeAttribute('src');
  preview.src = state.objectUrl;
  preview.classList.remove('hidden');

  preview.onloadedmetadata = () => {
    if (Number.isFinite(preview.duration)) {
      state.duration = preview.duration;
      el.fileMeta.textContent = `${formatBytes(file.size)} · ${formatDuration(preview.duration)}`;
      updateEstimate();
      refreshAdvice();
    }
  };

  el.filePanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function releasePreview() {
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }
  el.videoPreview.removeAttribute('src');
  el.audioPreview.removeAttribute('src');
}

function clearFile() {
  stopRun();
  releasePreview();
  state.file = null;
  state.duration = null;
  el.estimate.textContent = '';
  el.filePanel.classList.add('hidden');
  el.fileInput.value = '';
  resetOutput();
  clearError();
  showAdvice(null);
}

function resetOutput() {
  state.txt = '';
  state.srt = '';
  state.detected = null;
  el.langCheck.classList.add('hidden');
  el.outputPanel.classList.add('hidden');
  el.transcript.value = '';
}

/* ---------------- progress ---------------- */

const downloads = new Map();

function setProgress({ label, pct, indeterminate, note }) {
  el.progressWrap.classList.remove('hidden');
  el.progressLabel.textContent = label;
  el.progressTrack.classList.toggle('is-indeterminate', !!indeterminate);
  if (indeterminate) {
    el.progressPct.textContent = '';
  } else {
    el.progressPct.textContent = `${Math.round(pct)}%`;
    el.progressBar.style.width = `${pct}%`;
  }
  if (note === undefined) return;
  el.progressNote.innerHTML = note ?? '';
  el.progressNote.classList.toggle('hidden', !note);
}

function handleProgressEvent(event) {
  if (event.status === 'progress' && event.total) {
    downloads.set(event.file, { loaded: event.loaded, total: event.total });
    let loaded = 0;
    let total = 0;
    for (const d of downloads.values()) {
      loaded += d.loaded;
      total += d.total;
    }
    if (total > 0) {
      setProgress({
        label: t('scribe.download.label', { loaded: formatBytes(loaded), total: formatBytes(total) }),
        pct: (loaded / total) * 100,
        note: t('scribe.download.why'),
      });
    }
  }
}

/**
 * Real progress: the worker reports one completed 30-second window at a time,
 * so both the bar and the remaining-time figure are measured, not invented.
 */
function handleChunk({ done, total, elapsed }) {
  const pct = total > 0 ? (done / total) * 100 : 0;
  let note = '';

  if (done === 1) state.firstChunkMs = elapsed;

  if (done > 0 && done < total) {
    let remainingMs;
    if (done >= 2) {
      // Skip the first window when measuring the rate: it also pays for shader
      // compilation on the real audio shapes, which made the opening estimate
      // roughly 3x too pessimistic and then visibly lurch downwards.
      const perChunk = (elapsed - state.firstChunkMs) / (done - 1);
      remainingMs = perChunk * (total - done);
    } else {
      const ratio = SPEED[el.model.value]?.[state.device];
      remainingMs = ratio && state.duration
        ? ratio * state.duration * 1000 * ((total - done) / total)
        : null;
    }
    if (remainingMs != null) note = remainingText(remainingMs / 1000);
  }

  setProgress({
    label: total > 1
      ? t('scribe.stage.segment', { n: Math.min(done + 1, total), total })
      : t('scribe.stage.transcribing'),
    pct,
    note,
  });
}

/* ---------------- worker lifecycle ---------------- */

function ensureWorker() {
  if (worker) return worker;

  worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

  worker.addEventListener('message', (e) => {
    const msg = e.data;

    if (msg.type === 'progress') {
      handleProgressEvent(msg.event);
    } else if (msg.type === 'stage') {
      if (msg.stage === 'loading') {
        setProgress({ label: t('scribe.stage.preparing'), indeterminate: true, note: '' });
      } else if (msg.stage === 'warming') {
        setProgress({ label: t('scribe.stage.warming'), indeterminate: true, note: '' });
      } else if (msg.stage === 'detecting') {
        setProgress({ label: t('scribe.stage.detecting'), indeterminate: true, note: '' });
      } else if (msg.stage === 'transcribing') {
        state.totalChunks = msg.totalChunks ?? 0;
        setProgress({
          label: state.totalChunks > 1
            ? t('scribe.stage.segment', { n: 1, total: state.totalChunks })
            : t('scribe.stage.transcribing'),
          pct: 0,
          note: '',
        });
      }
    } else if (msg.type === 'detected') {
      state.detected = msg;
    } else if (msg.type === 'chunk') {
      handleChunk(msg);
    } else if (msg.type === 'done') {
      finish(msg);
    } else if (msg.type === 'error') {
      failRun(msg.message);
    }
  });

  worker.addEventListener('error', (e) => {
    failRun(e.message || t('scribe.err.worker'));
  });

  return worker;
}

function stopRun() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  downloads.clear();
  state.running = false;
  el.runBtn.disabled = false;
  el.runBtn.textContent = t('scribe.run');
  el.cancelBtn.classList.add('hidden');
  el.progressWrap.classList.add('hidden');
  el.progressNote.classList.add('hidden');
  el.progressNote.textContent = '';
  el.model.disabled = false;
  el.language.disabled = false;
}

function failRun(message) {
  stopRun();
  showError(t('scribe.err.failed', { message }));
}

function finish({ text, chunks, ms }) {
  const seconds = ms / 1000;
  stopRun();

  state.txt = (text || '').trim();
  state.srt = buildSrt(chunks || []);

  if (!state.txt) {
    showError(t('scribe.err.nospeech'));
    return;
  }

  const bits = [t('scribe.done', { time: formatDuration(seconds) })];
  if (state.detected?.code) {
    const language = languageName(state.detected.code);
    const confident = (state.detected.confidence ?? 0) >= 0.6;
    bits.push(t(confident ? 'scribe.done.detected' : 'scribe.done.unsure', { language }));
  }
  el.doneNote.textContent = bits.join(' · ');
  el.doneNote.classList.toggle('is-unsure', !!state.detected && (state.detected.confidence ?? 0) < 0.6);

  // Any wrong guess should be correctable without hunting for the control.
  el.langCheck.classList.toggle('hidden', !state.detected?.code);
  if (state.detected?.code) {
    el.langCheck.innerHTML = t('scribe.langCheck', { language: languageName(state.detected.code) });
  }
  el.outputPanel.classList.remove('hidden');
  setView(state.view);
  el.outputPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function startRun() {
  if (!state.file || state.running) return;

  clearError();
  resetOutput();
  downloads.clear();

  state.running = true;
  el.runBtn.disabled = true;
  el.runBtn.textContent = t('scribe.running');
  el.cancelBtn.classList.remove('hidden');
  el.model.disabled = true;
  el.language.disabled = true;

  setProgress({ label: t('scribe.stage.reading'), indeterminate: true, note: '' });

  let audio;
  try {
    ({ audio } = await decodeToMono16k(state.file));
  } catch (err) {
    stopRun();
    showError(t('scribe.err.decode'));
    return;
  }

  if (!state.running) return; // cancelled while decoding

  if (!audio.length) {
    stopRun();
    showError(t('scribe.err.noaudio'));
    return;
  }

  ensureWorker().postMessage(
    {
      type: 'run',
      payload: {
        model: el.model.value,
        device: state.device,
        language: el.language.value,
        audio,
      },
    },
    [audio.buffer]
  );
}

/* ---------------- output view ---------------- */

function setView(view) {
  state.view = view;
  el.transcript.value = view === 'srt' ? state.srt : state.txt;
  for (const tab of document.querySelectorAll('.tab')) {
    tab.classList.toggle('is-active', tab.dataset.view === view);
  }
}

/* ---------------- wiring ---------------- */

el.dropzone.addEventListener('click', () => el.fileInput.click());
el.dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    el.fileInput.click();
  }
});

el.fileInput.addEventListener('change', (e) => setFile(e.target.files?.[0]));

for (const type of ['dragenter', 'dragover']) {
  el.dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    el.dropzone.classList.add('is-over');
  });
}

for (const type of ['dragleave', 'drop']) {
  el.dropzone.addEventListener(type, (e) => {
    e.preventDefault();
    el.dropzone.classList.remove('is-over');
  });
}

el.dropzone.addEventListener('drop', (e) => setFile(e.dataTransfer?.files?.[0]));

// Stop a stray drop elsewhere on the page from navigating away from the app.
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

el.clearFile.addEventListener('click', clearFile);
el.runBtn.addEventListener('click', startRun);
el.cancelBtn.addEventListener('click', stopRun);

el.model.addEventListener('change', () => { updateEstimate(); refreshAdvice(); });

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => setView(tab.dataset.view));
}

el.copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(el.transcript.value);
    el.copyBtn.textContent = t('scribe.copied');
  } catch {
    el.transcript.select();
    el.copyBtn.textContent = t('scribe.copyManual');
  }
  setTimeout(() => { el.copyBtn.textContent = t('scribe.copy'); }, 1600);
});

el.dlTxt.addEventListener('click', () => {
  download(state.txt, `${baseName(state.file?.name ?? '')}_transcript.txt`, 'text/plain');
});

el.dlSrt.addEventListener('click', () => {
  download(state.srt, `${baseName(state.file?.name ?? '')}_subtitles.srt`, 'application/x-subrip');
});

window.addEventListener('beforeunload', (e) => {
  if (state.running) e.preventDefault();
});

// Anything written by script has to be redrawn on a language switch; the
// shared runtime only handles markup it can see.
document.addEventListener('wing:languagechange', () => {
  // Safe during a run: these only rewrite labels and hints, and never touch
  // the worker. Gating them on idle left stale text after a job finished.
  detectRuntime();
  refreshAdvice();
});

state.isMobile = isMobileDevice();
detectRuntime();
