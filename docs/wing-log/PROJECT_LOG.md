# Project Log: wing.cx

This log preserves the history and reasoning behind this project across sessions.
Each entry summarizes one work session. Topic files in this folder hold the
detailed decision records. Read those when you need to know why something was
built the way it was.

## Topic index

- topic-repo-and-hosting.md: the GitHub repo, Vercel deployment, canonical domain, and where the working copy lives
- topic-site-metadata.md: favicons, share card, meta and OG tags, sitemap, and how the image assets are generated
- topic-site-shell.md: the header, nav, footer, contact placement, responsive behaviour, and bilingual layout constraints

## Sessions

### 2026-08-25 - Ship V1.0, publish to GitHub and Vercel, then rework the shell

**Summary:** Started from a single self-contained index.html and published it as
a public GitHub repo wired to Vercel. Fixed a mobile layout bug that pushed the
hero CTAs below the fold, added the icon and social-card metadata the site was
missing, and settled the apex versus www question. Later in the session the nav
gained a Signals section alongside Ships, the brand and contact links were
reworked, and the tagline changed. A large part of the session was spent
untangling which folder actually held the live project.

**Topics touched:** topic-repo-and-hosting, topic-site-metadata, topic-site-shell

**Key outcomes:**
- Public repo daniel-wing/wing-cx created and deploying from main on Vercel. See topic-repo-and-hosting.
- wing.cx is canonical, www.wing.cx 308-redirects to it and preserves paths. See topic-repo-and-hosting.
- The working copy is ~/Projects/wing.cx. The Google Drive copy was stale and is gone. See topic-repo-and-hosting.
- Icons, OG and Twitter cards, robots.txt and sitemap.xml added. Share card is generated, not hand-drawn. See topic-site-metadata.
- Tagline changed to "Turning raw user feedback into clean data, and clean data into AI solutions that stick", propagated to both languages, the meta tags, and the share card. See topic-site-metadata.
- Nav is now Ships plus Signals. /signals ships with an empty state. See topic-site-shell.
- Contact moved out of the header to the bottom of each page, which removed the responsive breakage entirely. See topic-site-shell.
- One regression was introduced and fixed within the session: the Whisper attribution line on the Scribe page was dropped by a footer rewrite. See topic-site-shell.
