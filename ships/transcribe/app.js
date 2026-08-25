/* Transcribe — UI glue. Picks a runtime, decodes the file to 16 kHz mono,
   hands it to the worker, and turns the result into text + SRT. */

const $ = (id) => document.getElementById(id);

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
  'onnx-community/whisper-tiny':  { webgpu: 114, wasm: 39,  label: 'Tiny — fastest, roughest' },
  'onnx-community/whisper-base':  { webgpu: 197, wasm: 73,  label: 'Base — balanced' },
  'onnx-community/whisper-small': { webgpu: 559, wasm: 238, label: 'Small — most accurate, and no slower on a GPU' },
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

/* ---------------- runtime detection ---------------- */

async function detectRuntime() {
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) state.device = 'webgpu';
    } catch { /* fall through to WASM */ }
  }

  const fast = state.device === 'webgpu';
  el.runtimeBadge.classList.toggle('is-fast', fast);
  el.runtimeText.textContent = fast ? 'WebGPU' : 'CPU (WASM)';

  el.engineHint.textContent = fast
    ? 'Your GPU will do the work. The model downloads once, then your browser caches it — later visits start instantly.'
    : 'Your browser has no WebGPU, so this falls back to the CPU and will be noticeably slower. Chrome or Edge on a desktop gives you the fast path.';

  // Now that we know the runtime, show download sizes that are actually true.
  for (const option of el.model.options) {
    const spec = MODEL_MB[option.value];
    if (spec) option.textContent = `${spec.label} (~${spec[state.device]} MB)`;
  }

  updateEstimate();
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
  if (seconds < 20) return 'Almost done.';
  if (seconds < 50) return 'Less than a minute left.';
  if (seconds < 90) return 'About a minute left.';
  if (seconds < 60 * 60) return `About ${Math.round(seconds / 60)} min left.`;
  return `About ${(seconds / 3600).toFixed(1)} hr left.`;
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
    el.estimate.textContent = 'Should take under a minute.';
    return;
  }

  const lowMin = Math.max(1, Math.round(low / 60));
  const highMin = Math.max(lowMin + 1, Math.round(high / 60));
  el.estimate.textContent = `Roughly ${lowMin}–${highMin} min, depending on your computer.`;
}

/** Human-readable name for a whisper language code, from the picker itself. */
function languageName(code) {
  if (!code) return '';
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
      if (preview.duration > 3600) {
        showError(
          '<strong>Heads up:</strong> that is over an hour of audio. It will work, but it needs a lot of memory and will take a while. If your browser runs out of memory, split the file first.'
        );
      }
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
        label: `Downloading the speech model — ${formatBytes(loaded)} of ${formatBytes(total)}`,
        pct: (loaded / total) * 100,
        note:
          '<strong>Why is it downloading something?</strong> Because the transcription ' +
          'happens on your computer, the speech model has to come to your file — rather ' +
          'than your file being sent off to someone else\'s computer. That is the whole ' +
          'trade: a one-time download instead of uploading your video to a server. ' +
          'Your browser keeps the model afterwards, so this only happens once.',
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
    label: total > 1 ? `Transcribing — segment ${Math.min(done + 1, total)} of ${total}` : 'Transcribing…',
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
        setProgress({ label: 'Preparing the model…', indeterminate: true, note: '' });
      } else if (msg.stage === 'warming') {
        setProgress({ label: 'Warming up your GPU…', indeterminate: true, note: '' });
      } else if (msg.stage === 'detecting') {
        setProgress({ label: 'Working out the language…', indeterminate: true, note: '' });
      } else if (msg.stage === 'transcribing') {
        state.totalChunks = msg.totalChunks ?? 0;
        setProgress({
          label: state.totalChunks > 1 ? `Transcribing — segment 1 of ${state.totalChunks}` : 'Transcribing…',
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
    failRun(e.message || 'The transcription worker failed to start.');
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
  el.runBtn.textContent = 'Generate transcript';
  el.cancelBtn.classList.add('hidden');
  el.progressWrap.classList.add('hidden');
  el.progressNote.classList.add('hidden');
  el.progressNote.textContent = '';
  el.model.disabled = false;
  el.language.disabled = false;
}

function failRun(message) {
  stopRun();
  showError(`<strong>Transcription failed.</strong> ${message}`);
}

function finish({ text, chunks, ms }) {
  const seconds = ms / 1000;
  stopRun();

  state.txt = (text || '').trim();
  state.srt = buildSrt(chunks || []);

  if (!state.txt) {
    showError('<strong>Nothing to transcribe.</strong> No speech was detected in that file.');
    return;
  }

  const bits = [`Done in ${formatDuration(seconds)}`];
  if (state.detected?.code) {
    const name = languageName(state.detected.code);
    const confident = (state.detected.confidence ?? 0) >= 0.6;
    bits.push(confident ? `detected ${name}` : `detected ${name}, but not confidently`);
  }
  el.doneNote.textContent = bits.join(' · ');
  el.doneNote.classList.toggle('is-unsure', !!state.detected && (state.detected.confidence ?? 0) < 0.6);

  // Any wrong guess should be correctable without hunting for the control.
  el.langCheck.classList.toggle('hidden', !state.detected?.code);
  if (state.detected?.code) {
    el.langCheck.innerHTML =
      `Not ${languageName(state.detected.code)}? Pick the right language above and run it again.`;
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
  el.runBtn.textContent = 'Working…';
  el.cancelBtn.classList.remove('hidden');
  el.model.disabled = true;
  el.language.disabled = true;

  setProgress({ label: 'Reading the audio…', indeterminate: true, note: '' });

  let audio;
  try {
    ({ audio } = await decodeToMono16k(state.file));
  } catch (err) {
    stopRun();
    showError(
      '<strong>Could not read the audio from that file.</strong> ' +
      'Your browser can\'t decode this container or codec — MKV and AVI usually fail here. ' +
      'Re-saving it as MP4, WebM, M4A or WAV will fix it.'
    );
    return;
  }

  if (!state.running) return; // cancelled while decoding

  if (!audio.length) {
    stopRun();
    showError('<strong>That file has no audio track.</strong>');
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

el.model.addEventListener('change', updateEstimate);

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => setView(tab.dataset.view));
}

el.copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(el.transcript.value);
    el.copyBtn.textContent = 'Copied';
  } catch {
    el.transcript.select();
    el.copyBtn.textContent = 'Press ⌘C';
  }
  setTimeout(() => { el.copyBtn.textContent = 'Copy'; }, 1600);
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

detectRuntime();
