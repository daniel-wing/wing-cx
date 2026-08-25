# wing.cx

Personal website of Daniel Wing — AI & Analytics for Customer Experience.

**Live:** [wing.cx](https://wing.cx)

## What this is

A static site. No build step, no bundler, no framework — hand-written HTML with
CSS, served as-is. Fonts come from Google Fonts.

The homepage keeps its CSS inline. Everything under `/ships` shares
`assets/site.css`, which holds the palette tokens and the pill/panel idiom. If
the palette ever moves, update both.

## Structure

```
.
├── index.html              # homepage: markup + inline styles
├── assets/
│   └── site.css            # shared shell for /ships (tokens, header, panels)
├── ships/
│   ├── index.html          # index of shipped projects
│   └── transcribe/         # Ships #1 — browser-side Whisper transcription
│       ├── index.html      # markup + page styles
│       ├── app.js          # UI, audio decoding, SRT export
│       └── worker.js       # Whisper inference, off the main thread
├── og-image.jpg            # 1200x630 social share card
├── favicon.svg             # primary icon (scales to any size)
├── favicon-32.png          # raster fallback
├── apple-touch-icon.png    # 180x180, iOS home screen
├── sitemap.xml
├── robots.txt
└── README.md
```

The icons and share card are generated to match the site's palette
(`#4a9ec8` → `#3681ab`) and Plus Jakarta Sans. If the hero copy changes,
regenerate `og-image.jpg` so the card doesn't drift out of sync.

## Running locally

Open `index.html` in a browser, or serve the directory:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000

## Deploying

Deployed on [Vercel](https://vercel.com) from this repo. Vercel serves the
repo root as static output — no framework preset or build command needed.
Pushes to `main` deploy automatically.

## Ships

`/ships` is the shelf; each project gets a folder under it. To add one, drop in
`ships/<name>/index.html`, link `/assets/site.css`, and add a card to
`ships/index.html`.

### Transcribe

Whisper runs in the visitor's browser via
[transformers.js](https://github.com/huggingface/transformers.js) — no server,
no upload, no running cost. Model weights are fetched from the Hugging Face CDN
and cached by the browser after the first visit.

Two things in `worker.js` are load-bearing and were found the hard way. Both
have comments at the call site; re-verify before changing either.

- **transformers.js is pinned to 3.8.1.** 4.2.0 cannot create a WASM session for
  Whisper at any dtype, which hard-fails every visitor without WebGPU.
- **The WebGPU encoder stays `fp32`.** An `fp16` encoder halves the download and
  produces an endless run of em-dashes instead of speech.

#### Language detection

transformers.js never implemented it: `_retrieve_init_tokens` in its source
reads `// TODO: Implement language detection` and hardcodes English. Because
Whisper *translates* when told the wrong language, a Spanish recording came
back as fluent English prose — with a 19x repetition loop, which turned out to
be a symptom of the same cause rather than a separate bug. Same audio forced to
`es`: no repetition.

`worker.js` therefore implements detection the way Whisper does: feed the
decoder only `<|startoftranscript|>` and take the argmax over the language
token block. The library exposes no logits, but a `logits_processor` is just a
function it hands them to, which is enough to read them out. Detection runs on
the loudest 30-second window, since intros and silence derail it.

Never default the picker to the browser's locale. An English-locale browser is
no evidence the recording is English, and getting it wrong fails silently. The
detected language is always shown next to the result for that reason.

#### Desktop version

Long recordings are limited by browser memory, since the whole decoded audio is
held as a Float32Array. For those, `/ships/transcribe` links to a downloadable
desktop build, which lives in its own repository at
[daniel-wing/transcribe](https://github.com/daniel-wing/transcribe). It uses
faster-whisper rather than transformers.js, so it is far quicker and has no
length limit. The download links point at that repository's latest release; if
the asset filenames there ever change, update them in
`ships/transcribe/index.html`.

#### Speed

Wall-clock time as a multiple of audio length, measured on an M-series Mac
against a real lecture recording. Short clips finish disproportionately fast
and flatter these numbers, so don't benchmark with a ten-second sample.

| Model | WebGPU | WASM | 10-min video (WebGPU) |
|-------|--------|------|-----------------------|
| tiny  | 0.25x  | 0.52x | ~2.5 min |
| base  | 0.43x  | 0.74x | ~4.5 min |
| small | 0.33x  | n/a   | ~3.5 min |

`small` being *faster* than `base` on a GPU is not a typo, and it is
reproducible: larger models loop and hallucinate less, so they emit fewer
tokens per 30-second window, and the decode loop dominates. On a GPU `small`
is both quicker and more accurate — its only real cost is the 559 MB download.

These feed the up-front estimate in `SPEED` in `app.js`, which is shown as a
range because a slower machine can easily take twice as long. Once the first
segment completes, the UI switches to a figure measured on the visitor's own
hardware, ignoring the first window (it also pays for shader compilation and
runs ~3x slow).

## Roadmap

- [ ] Hero portrait cutout (slot exists in `.subject-wrapper`)
- [ ] More ships
