# Site shell: header, nav, footer, layout

**Status:** stable
**Last updated:** 2026-08-25

## What this covers

The chrome shared by every page. The header and nav capsule, the language
toggle, contact links, footers, and the responsive and bilingual constraints
that shaped all of it.

## Decisions

### 2026-08-25 - Empty portrait slot sizes to its content

- **Decision:** In the mobile media query, .subject-wrapper gets height auto and the fixed height moves onto .subject-img.
- **Why:** The wrapper reserved a hard 380px while the portrait img inside it was still commented out, pushing the hero CTAs to y=848 in an 812px viewport. They were below the fold on every phone.
- **Alternatives considered:** A .has-image modifier class on the wrapper, rejected because dropping the portrait in would then require remembering to add a class. The :empty selector, rejected because whitespace text nodes defeat it in practice.
- **Trade-offs accepted:** None. Uncommenting the img now just works.

### 2026-08-25 - Signals added as a peer of Ships

- **Decision:** The nav capsule carries Ships and Signals. Signals holds data-storytelling pieces, Ships holds tools and products. /signals ships with an empty state until the first piece lands.
- **Why:** A nav link to a 404 is worse than a nav link to an honest empty state.
- **Alternatives considered:** None considered on structure. Ships was left exactly as it was, per the request.
- **Trade-offs accepted:** None.

### 2026-08-25 - Active state marks the current section, not a favourite

- **Decision:** Both nav items render plain. The solid white treatment marks the current section, so Ships is solid on /ships and Signals on /signals, and neither is solid on the homepage.
- **Why:** Ships had been a solid white pill when it was the only item. With two items, leaving it solid would read as "Ships is selected" while standing on neither page.
- **Alternatives considered:** Keeping Ships solid on the homepage as a visual anchor, rejected as arbitrary and misleading.
- **Trade-offs accepted:** The homepage nav is quieter than it was.

### 2026-08-25 - Contact lives at the bottom, not in the header

- **Decision:** Say hi and LinkedIn moved out of the header. On the homepage they are pills in the hero button row. On /ships, /signals and Scribe they are plain text links in the footer.
- **Why:** Five controls could not share the header row, and contact is not navigation. Moving it down solved the layout problem and the information architecture at once.
- **Alternatives considered:** Hiding the brand on small screens to buy space, rejected as losing the site name. Dropping LinkedIn below 620px, rejected because it was explicitly wanted. Wrapping the header to two rows, which was actually built and then removed once contact left the header.
- **Trade-offs accepted:** The same link is labelled differently in the two places, which is deliberate and needs two i18n keys.

### 2026-08-25 - Footer links are plain text, hero links are pills

- **Decision:** The hero keeps pill buttons. The footers use plain muted links with no icons, matching wing.cx and wing@wing.cx beside them.
- **Why:** In the hero the pills are a call to action and earn the weight. In the footer the same pills read as buttons competing with the content. Icons went too, because no neighbouring footer link has one and keeping them left the row half-styled.
- **Alternatives considered:** Keeping small inline icons in the footer for channel clarity, still available if wanted.
- **Trade-offs accepted:** Losing the WhatsApp mark cost the label its meaning, which is why the footer label became WhatsApp rather than Say hi.

### 2026-08-25 - Separate i18n key for the footer WhatsApp label

- **Decision:** New key nav.whatsapp, value WhatsApp in both languages. The hero keeps nav.sayhi.
- **Why:** The hero has the WhatsApp mark next to the words, so "Say hi" reads fine. The footer has no icon and sits next to wing@wing.cx, which names its channel, so the label has to carry the meaning alone.
- **Alternatives considered:** Repointing nav.sayhi to WhatsApp everywhere, rejected because the hero wording was wanted as-is.
- **Trade-offs accepted:** Two keys for one destination. Deliberate, so the two labels cannot drift into each other.

### 2026-08-25 - Sticky footer via flex column

- **Decision:** body is a flex column, .page takes flex 1 0 auto, .site-footer takes flex-shrink 0.
- **Why:** body had min-height 100vh but nothing was told to fill it, so .page stopped where its content stopped and the footer sat wherever that landed. On /signals with one card it floated around 60% down the screen and read as content rather than page furniture.
- **Alternatives considered:** margin-top auto on the footer, which also works but needs care because the footer already uses margin 0 auto for horizontal centring.
- **Trade-offs accepted:** None. Long pages are unaffected.

### 2026-08-25 - Shared CSS pulled out of page-level style blocks

- **Decision:** The card grid moved from ships/index.html into site.css under neutral names, .card-grid and .card rather than .ships-grid and .ship-card. The homepage stopped redeclaring header CSS that site.css already owned.
- **Why:** /ships and /signals use the same idiom. Two inline copies would drift. The homepage had a second copy of the header rules that had to be edited in parallel with site.css.
- **Alternatives considered:** Duplicating the card CSS into signals/index.html, rejected for the same drift reason.
- **Trade-offs accepted:** A mechanical rename across one file, verified by grep before and after.

### 2026-08-26 - Plus Jakarta Sans self-hosted instead of loaded from Google

- **Decision:** The font now ships from /assets/fonts as two woff2 files, declared with @font-face at the top of site.css. All four pages dropped the two fonts preconnects and the fonts.googleapis.com stylesheet link, and gained a preload for the latin subset.
- **Why:** Every page was handing the visitor's IP to Google purely to draw text. It also cost a DNS lookup and TLS handshake to two extra origins before any text could render. The files served are the genuine Google Fonts builds, so nothing changes visually. This started as a requirement for /ships/2048, which promises zero network requests and could not link a CDN without making that promise false, and it made sense to bring the rest of the site along.
- **Alternatives considered:** Leaving the CDN in place for the site and self-hosting only inside the game, rejected because the two would then drift and the site would keep the third-party call for no benefit.
- **Trade-offs accepted:** The font is now a checked-in binary that has to be refreshed by hand if a newer version is wanted. 47.8 KB in the repo.

**Details.** One variable file covers the whole 200-800 axis, replacing the six static weights the old URL requested. The site uses 200 through 800; the old URL also asked for 900, which nothing ever used. Only the latin and latin-ext subsets ship: every accented character Spanish needs sits in U+0000-00FF inside latin, so an ES visitor never fetches latin-ext. SIL Open Font License 1.1, with OFL.txt beside the files as the licence requires.

**Note on Scribe.** /ships/scribe still contacts cdn.jsdelivr.net and huggingface.co at runtime, because that is where the Whisper model and transformers.js come from. That is inherent to what Scribe does and was not touched. Google Fonts is gone from every page, but "no third-party requests at all" is true of the site and the game, not of Scribe.

## How it works

Every page loads /assets/site.css, /assets/i18n.js and /assets/site.js. The
header is brand, then the nav capsule with Ships and Signals, then .nav-actions
holding only the language toggle. It is position sticky at top 0 with no
background band, so the pills float over the page.

Language: i18n.js holds two flat dictionaries keyed by dotted strings. site.js
resolves the language from ?lang, then localStorage, then navigator.languages,
defaulting to English. It rewrites textContent for [data-i18n], innerHTML for
[data-i18n-html], and aria-label and title for the label and title variants.
English is the fallback for any missing key, so a gap shows the original wording
rather than an empty element.

Contact: hero pills on the homepage, plain footer links elsewhere. WhatsApp
points at https://wa.me/REDACTED, which is confirmed working.

## Gotchas and things to remember

- English fitting a responsive layout proves nothing. The nav labels are translated and Spanish is much wider: Ships and Signals become Proyectos and Señales. A first attempt shaved padding until English fit at 375px, and Spanish still cut off the last control. Always check the longest language before calling a responsive fix done.
- The homepage keeps its own inline style block for hero-specific CSS and its own body rules. site.css is loaded first, so inline wins on any shared property. Header styles belong in site.css only.
- ships/scribe defines its own .btn-icon for the small circular remove-file control. A .btn-icon was briefly added to site.css for the header and shadowed it. Both header button styles have since been deleted, so the collision is gone, but do not reintroduce a global .btn-icon.
- position sticky still works with body as a flex column. Verified by scrolling to 600px and confirming the header stays at top 0.
- The Scribe footer is not identical to the others. It carries a "Powered by OpenAI Whisper via transformers.js" attribution line. A footer rewrite in this session replaced all three footers with one template and silently dropped it. It was restored in the same session. Do not template that footer without carrying the attribution across.

## Open questions

- /signals has no content yet. The empty state reads "First one in the works" and "La primera, en camino". The card markup to copy is in ships/index.html.
- The hero portrait slot in .subject-wrapper is still an empty commented-out img. Dropping an image in needs no CSS changes.
