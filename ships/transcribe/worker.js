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

// Must mirror the windowing inside transformers.js's chunked Whisper path so
// our chunk count matches the number of generate() calls it will actually make.
const CHUNK_LENGTH_S = 30;
const STRIDE_LENGTH_S = 5;

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
      // Always pass an explicit language and task. Left to detect on its own,
      // this model reliably guesses <|en|> on non-English audio and then
      // *translates* it to English instead of transcribing — a silent wrong
      // answer. The UI therefore always sends a real language code.
      language: language || 'en',
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
      ms: performance.now() - started,
    });
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message ?? String(err) });
  }
}

self.addEventListener('message', (e) => {
  if (e.data?.type === 'run') run(e.data.payload);
});
