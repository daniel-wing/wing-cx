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

There is deliberately no "detect language automatically" option. Whisper's
detection here reports English for non-English audio and then *translates* it
rather than transcribing — a silently wrong answer. The language selector
defaults to the browser's own language instead.

Measured on an M-series Mac, `base` model: ~4s of WebGPU per 11s of audio,
versus ~28s on the WASM fallback.

## Roadmap

- [ ] Hero portrait cutout (slot exists in `.subject-wrapper`)
- [ ] More ships
