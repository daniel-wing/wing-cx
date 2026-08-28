# Working in this repo

A hand-written static site, no build step, deployed to https://wing.cx by Vercel
on every push to `main`. More than one session edits this working copy, so check
`git log` before starting and prefer explicit paths over `git add -A`.

Run `scripts/audit.sh` before committing. It checks the invariants below and is
also enforced by a GitHub Action. Use `--offline` to skip the network checks.

## Everything in the repo root is published

Vercel serves the repository root as static output, so **any file committed here
becomes a public URL**, including markdown. `docs/` is deliberately untracked
and `.gitignore`d for this reason: it was previously readable at
`wing.cx/docs/**` and was publishing DNS and hosting details. Do not re-add it.

## Structure

```
index.html            homepage, shared assets plus inline hero CSS
assets/site.css       shared shell: tokens, header, pills, panels, toggle
assets/i18n.js        every visible string, English and Spanish
assets/site.js        language switching
ships/index.html      the shelf
ships/scribe/         browser Whisper transcription: index.html, app.js, worker.js
ships/2048/           GENERATED, see below
signals/index.html    data write-ups
vercel.json           redirects and rewrites
scripts/audit.sh      the consistency checks
```

## Language

Both languages, one set of pages, translated at runtime. Markup carries
`data-i18n="key"`, or `data-i18n-html` for strings containing tags, plus
`data-i18n-label` and `data-i18n-title` for attributes. Scripts translate with
`wingT('key', { vars })`.

- **Every new string needs an entry in both dictionaries.** English is the
  fallback, so a missing Spanish key is invisible until someone reads the page.
  The audit checks parity.
- **Anything a script writes must be redrawn on `wing:languagechange`.** The
  markup pass cannot see it. This has caused a stale-label bug twice, once on
  each codebase.
- **Do not add language names to the dictionary.** `Intl.DisplayNames` knows
  them all and gets each locale's casing right.
- **Test layout in Spanish.** It is the wider language, and English fitting at
  375px proves nothing.

## Header

- Styles live in `assets/site.css` only. The homepage keeps an inline block for
  hero-specific CSS; `site.css` loads first so inline wins where they overlap.
- Pinned with `position: sticky` and **no background band**, deliberately. It
  was tried and removed: it read as chrome rather than as floating pills.
- Contact belongs in the hero and the footers, not the header. Five controls did
  not fit one row. Do not put anything back into `.nav-actions` beyond the
  language toggle.
- Do not reintroduce a global `.btn-icon`; it shadows Scribe's remove-file
  control.

## ships/2048 is generated

Built from the separate `daniel-wing/2048` repo and exported here. Do not
hand-edit it; changes are overwritten on the next export. It inlines a copy of
the header CSS with the palette hardcoded, so **a palette change here does not
reach it** until that repo is rebuilt. The audit compares the two and fails on
drift.

## When the palette changes

`og-image.jpg` does not update itself. Regenerate it, or the social card keeps
the old colours, which is exactly what happened when the gradient was darkened.
The recipe is in `docs/wing-log/topic-site-metadata.md` (on disk, untracked).

## Naming

The tool is **Scribe**. `Transcribe` is only correct as Whisper's
`task: 'transcribe'`, the `transcriber` variable, and the verb "Transcribing".
`/ships/transcribe` must keep redirecting; the URL was shared before the rename.
