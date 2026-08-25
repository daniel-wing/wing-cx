/* Whisper inference, off the main thread.
   Everything here runs in the visitor's browser — no audio ever leaves the device. */

// Pinned deliberately. transformers.js 4.2.0 cannot create a WASM session for
// Whisper at any dtype ("Missing required scale ... MatMulNBits"), which would
// hard-fail every visitor without WebGPU. 3.8.1 runs both backends correctly.
// Verify both paths before bumping this.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';

// We only ever load models from the Hugging Face hub; never look for a local
// /models directory on wing.cx (which would 404 on every request).
env.allowLocalModels = false;

/**
 * WebGPU runs a full-precision encoder with a 4-bit decoder; WASM runs
 * fully int8-quantized.
 *
 * The encoder stays fp32 on purpose. An fp16 encoder halves the download but
 * produces degenerate output on this model family — it emits an endless run of
 * em-dashes instead of speech — so don't "optimize" it back.
 */
function configFor(device) {
  if (device === 'webgpu') {
    return {
      device: 'webgpu',
      dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
    };
  }
  return { device: 'wasm', dtype: 'q8' };
}

// Must mirror the windowing inside transformers.js's chunked Whisper path so
// our chunk count matches the number of generate() calls it will actually make.
const CHUNK_LENGTH_S = 30;
const STRIDE_LENGTH_S = 5;

// Whisper's language tokens occupy one contiguous block, <|en|> .. <|su|>.
const LANG_TOKEN_LO = 50259;
const LANG_TOKEN_HI = 50357;
const SOT_TOKEN = 50258; // <|startoftranscript|>

/**
 * Detection is deliberately run on the loudest 30-second window rather than the
 * opening one: intros, silence and music derail it.
 */
function loudestWindow(audio, samplingRate = 16000) {
  const window = samplingRate * CHUNK_LENGTH_S;
  if (audio.length <= window) return audio;

  const step = samplingRate * 15;
  let bestStart = 0;
  let bestEnergy = -1;
  for (let start = 0; start + window <= audio.length; start += step) {
    let energy = 0;
    // Sampled every 10ms; a full sum over every window is pure waste here.
    for (let i = start; i < start + window; i += 160) energy += Math.abs(audio[i]);
    if (energy > bestEnergy) {
      bestEnergy = energy;
      bestStart = start;
    }
  }
  return audio.subarray(bestStart, bestStart + window);
}

/**
 * transformers.js never implemented this — its source reads
 * "TODO: Implement language detection" and hardcodes English, which makes it
 * silently *translate* anything that isn't English. The model itself is
 * perfectly capable, so we do what Whisper does: feed only
 * <|startoftranscript|> and read the next-token distribution over the language
 * tokens. The library exposes no logits, but a logits_processor is just a
 * function it calls with them, which is enough to read them out.
 */
async function detectLanguage(transcriber, audio) {
  const features = await transcriber.processor(loudestWindow(audio));

  let captured = null;
  await transcriber.model.generate({
    ...features,
    decoder_input_ids: [SOT_TOKEN],
    max_new_tokens: 1,
    return_timestamps: false,
    logits_processor: [(ids, logits) => { captured ??= logits; return logits; }],
  });
  if (!captured?.data) return null;

  const data = captured.data;
  let bestId = -1;
  let bestScore = -Infinity;
  for (let id = LANG_TOKEN_LO; id <= LANG_TOKEN_HI; id++) {
    const score = Number(data[id]);
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  if (bestId < 0) return null;

  let sum = 0;
  for (let id = LANG_TOKEN_LO; id <= LANG_TOKEN_HI; id++) sum += Math.exp(Number(data[id]) - bestScore);

  return {
    code: transcriber.tokenizer.decode([bestId], { skip_special_tokens: false }).replace(/[<|>]/g, ''),
    confidence: 1 / sum,
  };
}

let pipePromise = null;
let pipeKey = null;

function getPipeline({ model, device }) {
  const key = `${model}|${device}`;
  if (pipePromise && pipeKey === key) return pipePromise;

  pipeKey = key;
  pipePromise = (async () => {
    const transcriber = await pipeline('automatic-speech-recognition', model, {
      ...configFor(device),
      progress_callback: (event) => self.postMessage({ type: 'progress', event }),
    });

    // The first WebGPU call pays for shader compilation. Do it on a second of
    // silence so that cost lands on the progress bar, not on the real audio.
    if (device === 'webgpu') {
      self.postMessage({ type: 'stage', stage: 'warming' });
      await transcriber(new Float32Array(16000), { language: 'en' });
    }

    return transcriber;
  })().catch((err) => {
    // Don't cache a rejected pipeline — let the next attempt retry cleanly.
    pipePromise = null;
    pipeKey = null;
    throw err;
  });

  return pipePromise;
}

function countChunks(numSamples, samplingRate = 16000) {
  const window = samplingRate * CHUNK_LENGTH_S;
  const jump = window - 2 * samplingRate * STRIDE_LENGTH_S;
  let offset = 0;
  let n = 0;
  while (true) {
    n++;
    if (offset + window >= numSamples) break;
    offset += jump;
  }
  return n;
}

async function run({ model, device, audio, language }) {
  try {
    self.postMessage({ type: 'stage', stage: 'loading' });
    const transcriber = await getPipeline({ model, device });

    let resolvedLanguage = language;
    let detected = null;
    if (!resolvedLanguage) {
      self.postMessage({ type: 'stage', stage: 'detecting' });
      detected = await detectLanguage(transcriber, audio);
      resolvedLanguage = detected?.code || 'en';
      self.postMessage({ type: 'detected', code: resolvedLanguage, confidence: detected?.confidence ?? 0 });
    }

    const totalChunks = countChunks(audio.length);
    self.postMessage({ type: 'stage', stage: 'transcribing', totalChunks });
    const started = performance.now();

    // The pipeline exposes no per-chunk hook, but it forwards these options
    // into model.generate(), which drives a streamer. One end() per 30s window
    // gives us honest progress instead of a bar that only pretends to move.
    let doneChunks = 0;
    const streamer = {
      put() {},
      end() {
        doneChunks++;
        self.postMessage({
          type: 'chunk',
          done: doneChunks,
          total: totalChunks,
          elapsed: performance.now() - started,
        });
      },
    };

    const output = await transcriber(audio, {
      // Never left blank: a missing language makes the library assume English
      // and translate instead of transcribe. By this point it is either the
      // visitor's explicit choice or the result of detectLanguage().
      language: resolvedLanguage,
      task: 'transcribe',
      return_timestamps: true,
      chunk_length_s: CHUNK_LENGTH_S,
      stride_length_s: STRIDE_LENGTH_S,
      streamer,
    });

    self.postMessage({
      type: 'done',
      text: output.text ?? '',
      chunks: output.chunks ?? [],
      language: resolvedLanguage,
      detected: detected ? { code: detected.code, confidence: detected.confidence } : null,
      ms: performance.now() - started,
    });
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message ?? String(err) });
  }
}

self.addEventListener('message', (e) => {
  if (e.data?.type === 'run') run(e.data.payload);
});
