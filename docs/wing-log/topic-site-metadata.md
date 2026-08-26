# Site metadata and image assets

**Status:** stable
**Last updated:** 2026-08-25

## What this covers

Everything that describes the site to something other than a human reader:
favicons, the social share card, meta and Open Graph tags, robots.txt and
sitemap.xml. Also the technique used to generate the raster assets, which is
worth reusing.

## Decisions

### 2026-08-25 - Generate image assets in the browser, write them via a local server

- **Decision:** Render the share card and icons on an HTML canvas in the browser, then POST the base64 result to a small local Python HTTP server that decodes it and writes the file straight into the project.
- **Why:** There is no SVG rasterizer on this machine. No rsvg-convert, no ImageMagick, no Pillow, no cairosvg. Only macOS sips, which cannot read SVG. Canvas can draw the real fonts and gradients, and a same-origin POST moves the bytes to disk without passing them through the model context.
- **Alternatives considered:** Chunking the base64 back through the conversation, which was tried first and abandoned. The PNG share card came to 706KB base64 and even the JPEG was 69KB, needing multiple round trips with a real risk of truncation, and burning context for no benefit. Also considered hand-writing a PDF with base-14 Helvetica and converting it with sips, rejected because the type would not match the site.
- **Trade-offs accepted:** The generator is a scratch script, not committed. Regenerating means rewriting it. The recipe is recorded below so that is cheap.

### 2026-08-25 - Share card is JPEG, not PNG

- **Decision:** og-image.jpg, 1200x630, quality 0.86, roughly 50KB.
- **Why:** The card background is a smooth radial gradient, which PNG compresses badly. The same image was 530KB as PNG and 50KB as JPEG with no visible difference. LinkedIn and other scrapers handle JPEG fine.
- **Alternatives considered:** PNG, rejected on size. A flat background that would compress well as PNG, rejected because the gradient matches the site.
- **Trade-offs accepted:** Slight JPEG artifacting on the gradient, invisible at card size.

### 2026-08-25 - SVG favicon with raster fallbacks

- **Decision:** favicon.svg as the primary icon, favicon-32.png as a fallback, apple-touch-icon.png at 180x180. No favicon.ico.
- **Why:** SVG scales to any size and is 563 bytes. Browsers only request /favicon.ico when no link rel=icon is declared, and three are declared.
- **Alternatives considered:** Shipping a .ico, rejected as unnecessary. An icon-512.png for a web manifest, generated then deleted because the gradient made it 180KB and there is no manifest to use it.
- **Trade-offs accepted:** None.

### 2026-08-25 - Tagline change propagated everywhere, including the card

- **Decision:** New tagline is "Turning raw user feedback into clean data, and clean data into AI solutions that stick". Updated in the visible hero, both language dictionaries, the meta description, og:description, twitter:description, and the share card image.
- **Why:** The old wording was baked into the generated JPEG as pixels. Changing only the HTML would have left the share card contradicting the page.
- **Alternatives considered:** None considered. Leaving the card stale was not acceptable.
- **Trade-offs accepted:** Any tagline change means regenerating the card.

## How it works

The head of each page carries a description, rel=canonical, theme-color, three
icon links, a full Open Graph block with explicit image type, width, height and
alt, and a Twitter summary_large_image block. robots.txt allows everything and
points at the sitemap. sitemap.xml lists the homepage, /ships, /ships/scribe and
/signals.

To regenerate the share card: write a small Python http.server that serves one
HTML page and accepts POST /save?name=<file>, decoding the body from base64 and
writing it into the project folder. The page loads Plus Jakarta Sans from Google
Fonts, awaits document.fonts.ready, draws a 1200x630 canvas with a radial
gradient from #4a9ec8 to #3681ab centred at 50% 35%, lays out the name, the two
subtitle lines, the wrapped tagline and "wing.cx", then POSTs
canvas.toDataURL('image/jpeg', 0.86). Open it in the browser once and the file
lands on disk. Same approach with smaller canvases produced the icons.

## Gotchas and things to remember

- Fonts must be loaded before drawing. Await document.fonts.load for each weight and size, then document.fonts.ready, or canvas silently falls back to a system font and the card looks wrong.
- Serve the generator over http from a local server rather than injecting into an https page. Same-origin means no CORS and no mixed-content blocking.
- LinkedIn caches the share card per URL and does not re-fetch on later shares. After changing the card or the tags, re-scrape at linkedin.com/post-inspector or the old version keeps appearing.
- Post Inspector reports Type: Article and flags a missing author and publish date even though og:type is website. That is LinkedIn's own classification and neither field appears on the rendered card. Ignorable.
- The og:image URL is absolute and points at the apex. If the canonical hostname ever changes, that URL has to change with it.

## Open questions

- None outstanding.
