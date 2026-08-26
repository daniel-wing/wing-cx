# Infrastructure

What it takes to serve wing.cx, recorded because none of it lives in git.

A `git clone` gives you every file and the full history. It does not give you
the Vercel project, the domain configuration, or the DNS records. If this had to
be rebuilt on a new account, this page is the checklist.

Last verified: 2026-08-25.

## Domain and DNS

The domain is `wing.cx`. DNS is served by Namecheap's nameservers:

```
dns1.registrar-servers.com
dns2.registrar-servers.com
```

Records pointing at Vercel:

| Host | Type | Value |
|------|------|-------|
| `wing.cx` (apex) | A | `216.198.79.1` |
| `www` | CNAME | `c0b56f84b6967002.vercel-dns-017.com` |

The CNAME target is issued per-project by Vercel. A rebuilt project gets a
different one, so copy whatever the Vercel Domains panel shows rather than
reusing the value above.

## Vercel

Project `wing-cx`, connected to the GitHub repo `daniel-wing/wing-cx`. Pushes to
`main` deploy automatically. Deploys take roughly ten to thirty seconds.

Build settings: framework preset **Other**, no build command, no output
directory. The repo root is served as static output. There is no build step and
nothing to install.

Environment variables: none. The site is fully static and calls no APIs, so
there is nothing to configure and no secret to store. If that ever changes, the
value goes in Vercel's environment variables, never in the repo.

### Domains panel

Two entries, and the pairing matters:

| Domain | Setting |
|--------|---------|
| `wing.cx` | Connect to an environment, Production |
| `www.wing.cx` | Redirect to Another Domain, 308 Permanent Redirect, target `wing.cx` |

The default `wing-cx.vercel.app` alias also resolves and serves the site.

Expected behaviour, worth re-checking after any domain change:

```
curl -sSI https://www.wing.cx/   # 308, location: https://wing.cx/
curl -sSI https://wing.cx/       # 200, server: Vercel
```

The redirect preserves paths, so `www.wing.cx/ships` reaches `wing.cx/ships`
rather than dumping visitors on the homepage.

## Repo-level config

`vercel.json` holds the only routing rule, a permanent redirect kept from the
rename of Transcribe to Scribe:

```
/ships/transcribe        -> /ships/scribe
/ships/transcribe/:path* -> /ships/scribe/:path*
```

That file is in git, so it is the one piece of hosting config that does travel
with a clone.

## Rebuilding from nothing

1. Clone `daniel-wing/wing-cx`.
2. Create a Vercel project from the repo. Framework preset Other, no build command.
3. Add `wing.cx` in Domains, set to Connect to an environment, Production.
4. Add `www.wing.cx`, set to Redirect to Another Domain, 308, target `wing.cx`.
5. At the registrar, point the apex A record and the `www` CNAME at the values Vercel shows for the new project.
6. Verify with the two curl commands above.

## Gotchas

- Setting the apex as primary does not automatically point `www` at it. The `www` row keeps its own redirect target, which can sit at "No Redirect" and silently serve the content instead of redirecting. This happened once. Set the target explicitly and confirm with curl.
- A row in the Vercel Domains panel with an active Save button has unsaved edits. A greyed-out Save means what is shown is the saved state.
- `og:image` and `rel=canonical` are absolute URLs pointing at the apex. Changing the canonical hostname means editing them in every page's head.

## Not recorded here

Account credentials for GitHub, Vercel and the registrar. Those belong in a
password manager, not in a repo, public or private.
