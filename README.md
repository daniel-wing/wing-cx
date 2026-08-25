# wing.cx

Personal website of Daniel Wing — AI & Analytics for Customer Experience.

**Live:** [wing.cx](https://wing.cx)

## What this is

A single-page static site. No build step, no dependencies, no framework — one
self-contained `index.html` with inline CSS. Fonts are pulled from Google Fonts.

## Structure

```
.
├── index.html            # the whole site: markup + inline styles
├── og-image.jpg          # 1200x630 social share card
├── favicon.svg           # primary icon (scales to any size)
├── favicon-32.png        # raster fallback
├── apple-touch-icon.png  # 180x180, iOS home screen
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

## Roadmap

- [ ] Project / case-study pages ("My work" — currently marked WIP)
- [ ] Hero portrait cutout (slot exists in `.subject-wrapper`)
