# Repo and hosting

**Status:** stable
**Last updated:** 2026-08-25

## What this covers

Where the source lives, how it reaches production, and which hostname is
canonical. Also records the folder confusion that cost real time in this
session, so it is not repeated.

## Decisions

### 2026-08-25 - Public repo named wing-cx

- **Decision:** Publish as a public GitHub repo called wing-cx under daniel-wing.
- **Why:** Personal site, nothing sensitive in it, and being public lets the work be shown. Dashes rather than dots in the repo name because GitHub allows dots but some tooling handles them badly.
- **Alternatives considered:** Private repo, which Vercel deploys equally well. Repo named wing.cx to match the domain exactly, and personal-website as a domain-independent name. The user picked public and wing-cx.
- **Trade-offs accepted:** Repo name and domain no longer match character for character.

### 2026-08-25 - Static output, no framework preset

- **Decision:** Deploy on Vercel with framework preset Other, no build command, no output directory. Vercel serves the repo root.
- **Why:** The site is hand-written HTML, CSS and JS with no build step. Adding a toolchain would buy nothing.
- **Alternatives considered:** None considered. A build step was never needed.
- **Trade-offs accepted:** None meaningful at this size.

### 2026-08-25 - Apex is canonical, www redirects to it

- **Decision:** wing.cx serves the site. www.wing.cx issues a 308 to the apex.
- **Why:** The user chose the apex as the shorter, cleaner form that matches the brand. Having both hostnames serve identical content is duplicate content, even if rel=canonical mitigates it.
- **Alternatives considered:** Keeping www as primary, which was the original Vercel setup and needed no dashboard change.
- **Trade-offs accepted:** None. The redirect preserves paths, so future pages work without extra config.

### 2026-08-25 - Working copy moved out of Google Drive

- **Decision:** The working copy is ~/Projects/wing.cx. The Google Drive copy is gone.
- **Why:** Google Drive syncs the .git directory as loose files with no understanding that they form one consistent database. Two machines, partial uploads, or Drive evicting a file's contents to reclaim space can all leave a repo that will not open. GitHub already provides the backup and version history Drive was duplicating.
- **Alternatives considered:** Leaving it in Drive, since a single machine with a small repo is fairly low risk and nothing had gone wrong yet.
- **Trade-offs accepted:** None. Drive was providing no value git did not already provide better.

## How it works

Source lives at ~/Projects/wing.cx, remote is https://github.com/daniel-wing/wing-cx.
Pushes to main auto-deploy on Vercel. Deploys land in roughly ten to thirty
seconds. Verify a deploy by curling the changed asset and diffing against the
local file rather than trusting the dashboard.

Vercel Domains holds two entries. wing.cx is set to Connect to an environment,
Production. www.wing.cx is set to Redirect to Another Domain, 308, target
wing.cx.

## Gotchas and things to remember

- Setting the apex as primary in Vercel does not automatically point www at it. The www row keeps a Redirect to Another Domain setting whose target can be left as "No Redirect", which silently serves the content instead of redirecting. The target dropdown has to be set explicitly.
- A row in Vercel Domains with an active Save button has unsaved edits. A greyed Save means what you see is the saved state.
- There are two separate repos and they are correctly separate. daniel-wing/wing-cx is the website, including the browser version of Scribe at /ships/scribe. daniel-wing/scribe is the desktop version, Python and PyInstaller, which builds the .dmg and .exe. The web page links to the desktop repo's GitHub Releases.
- The local folder ~/Projects/transcribe contains the repo named scribe. The folder name is stale after the rename. The user chose to leave it as is. Do not read the folder name as evidence that something is misfiled.
- Early in this session the assistant worked in a Google Drive folder believing it was the live project. It was a stale V1.0 copy. The real project, already containing /ships and Scribe, was at ~/Projects/wing.cx the whole time. Check the primary working directory before assuming which copy is live.

## Open questions

- During the session a git clone into ~/Projects/wing.cx reported only four commits and nine files, while the directory later plainly held the full project with the complete history. The two observations were never reconciled. Current state was verified healthy and matching GitHub, so nothing was lost, but the cause is unexplained. Rationale not captured.
