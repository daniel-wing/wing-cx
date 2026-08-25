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

async function run({ model, device, audio, language }) {
  try {
    self.postMessage({ type: 'stage', stage: 'loading' });
    const transcriber = await getPipeline({ model, device });

    self.postMessage({ type: 'stage', stage: 'transcribing' });
    const started = performance.now();

    const output = await transcriber(audio, {
      // Always pass an explicit language and task. Left to detect on its own,
      // this model reliably guesses <|en|> on non-English audio and then
      // *translates* it to English instead of transcribing — a silent wrong
      // answer. The UI therefore always sends a real language code.
      language: language || 'en',
      task: 'transcribe',
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    self.postMessage({
      type: 'done',
      text: output.text ?? '',
      chunks: output.chunks ?? [],
      ms: performance.now() - started,
    });
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message ?? String(err) });
  }
}

self.addEventListener('message', (e) => {
  if (e.data?.type === 'run') run(e.data.payload);
});
