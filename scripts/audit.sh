#!/usr/bin/env bash
# Read-only consistency checks for wing.cx.
#
# Two sessions edit this repo, and the drift this catches is the drift that
# actually happened: strings defined but never hooked up, a page missing from
# the sitemap, a palette changed in one place and not another.
#
# Usage:  scripts/audit.sh [--offline]
#         --offline skips the checks that need the network.
#
# Exits non-zero if anything fails, so CI can gate on it.

set -uo pipefail
cd "$(dirname "$0")/.."

OFFLINE=0
[ "${1:-}" = "--offline" ] && OFFLINE=1

FAILED=0
pass() { printf '  ok    %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1"; FAILED=1; }
info() { printf '        %s\n' "$1"; }

# ships/2048 is a build artifact from another repository. It is excluded from
# the content checks on purpose: editing it here would be overwritten on the
# next export.
PAGES=(index.html ships/index.html ships/scribe/index.html signals/index.html)

echo "wing.cx audit"
echo

# ---------------------------------------------------------------- 1 + 2
echo "Translations"
node - <<'JS'
const fs = require('fs');
global.window = {};
eval(fs.readFileSync('assets/i18n.js', 'utf8'));
const dict = window.WING_STRINGS;
const en = Object.keys(dict.en), es = Object.keys(dict.es);

let bad = 0;
const missingEs = en.filter(k => !es.includes(k));
const missingEn = es.filter(k => !en.includes(k));
if (missingEs.length) { console.log('  FAIL  keys missing from es: ' + missingEs.join(', ')); bad = 1; }
if (missingEn.length) { console.log('  FAIL  keys missing from en: ' + missingEn.join(', ')); bad = 1; }
if (!bad) console.log(`  ok    en and es both define ${en.length} keys`);

const pages = ['index.html','ships/index.html','ships/scribe/index.html','signals/index.html'];
const unresolved = [];
for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  for (const m of html.matchAll(/data-i18n(?:-html|-label|-title)?="([^"]+)"/g)) {
    if (!(m[1] in dict.en) || !(m[1] in dict.es)) unresolved.push(`${page}: ${m[1]}`);
  }
}
if (unresolved.length) { console.log('  FAIL  keys used in markup but not defined:'); unresolved.forEach(u => console.log('          ' + u)); bad = 1; }
else console.log('  ok    every key used in markup resolves in both languages');

process.exit(bad);
JS
[ $? -ne 0 ] && FAILED=1

# ---------------------------------------------------------------- 3
python3 - <<'PY'
import sys
from html.parser import HTMLParser

# Walk the DOM rather than pattern-matching the source: a hook on an ancestor
# legitimately covers inline children such as <strong>, and a regex cannot
# tell that apart from genuinely unhooked text.
PAGES = ['index.html', 'ships/index.html', 'ships/scribe/index.html', 'signals/index.html']
SKIP = {'script', 'style', 'title', 'option', 'noscript'}
VOID = {'br', 'img', 'input', 'meta', 'link', 'hr', 'source', 'path'}
MIN = 25


class Scan(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.loose = []

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        hooked = any(k.startswith('data-i18n') for k, _ in attrs)
        inherited = bool(self.stack and self.stack[-1][1])
        self.stack.append((tag, hooked or inherited))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        text = ' '.join(data.split())
        if len(text) < MIN:
            return
        if any(t in SKIP for t, _ in self.stack):
            return
        if self.stack and self.stack[-1][1]:
            return
        self.loose.append(text[:60])


loose = []
for page in PAGES:
    scan = Scan()
    scan.feed(open(page, encoding='utf-8').read())
    loose += ['{}: {}'.format(page, t) for t in scan.loose]

if loose:
    print('  FAIL  visible text with no translation hook:')
    for entry in loose:
        print('          ' + entry)
    sys.exit(1)
print('  ok    no unhooked visible text')
PY
[ $? -ne 0 ] && FAILED=1
echo

# ---------------------------------------------------------------- 4
echo "Sitemap"
SITEMAP_MISSING=0
for page in "${PAGES[@]}"; do
  case "$page" in
    index.html)             url="https://wing.cx/" ;;
    ships/index.html)       url="https://wing.cx/ships" ;;
    signals/index.html)     url="https://wing.cx/signals" ;;
    *)                      url="https://wing.cx/${page%/index.html}" ;;
  esac
  grep -q "<loc>$url</loc>" sitemap.xml || { fail "sitemap is missing $url"; SITEMAP_MISSING=1; }
done
[ $SITEMAP_MISSING -eq 0 ] && pass "every page is listed in the sitemap"

while read -r loc; do
  path="${loc#https://wing.cx}"
  path="${path#/}"
  [ -z "$path" ] && continue
  [ -f "$path/index.html" ] || fail "sitemap lists /$path but $path/index.html does not exist"
done < <(grep -o '<loc>[^<]*</loc>' sitemap.xml | sed 's/<[^>]*>//g')
echo

# ---------------------------------------------------------------- 5
echo "Naming"
# The verb, the pipeline variable and Whisper's own task value are all correct.
STALE=$(grep -rn "Transcribe" "${PAGES[@]}" assets/ 2>/dev/null \
  | grep -v "Transcribing" || true)
if [ -n "$STALE" ]; then
  fail "the old product name appears in user-facing content:"
  echo "$STALE" | sed 's/^/          /'
else
  pass "no stale product name outside the allowed uses"
fi
echo

# ---------------------------------------------------------------- 6
echo "Routing"
python3 -c "import json,sys; json.load(open('vercel.json'))" 2>/dev/null \
  && pass "vercel.json parses" || fail "vercel.json is not valid JSON"
grep -q '"/ships/transcribe"' vercel.json \
  && pass "the /ships/transcribe redirect is still present" \
  || fail "the /ships/transcribe redirect is gone; old links will break"
echo

# ---------------------------------------------------------------- 7
echo "Palette"
# ships/2048 is generated elsewhere and hardcodes the palette instead of using
# the tokens, so it silently goes stale when the colours move.
TOP=$(grep -o -- '--bg-top: *#[0-9a-fA-F]\{6\}' assets/site.css | head -1 | grep -o '#[0-9a-fA-F]\{6\}')
BOTTOM=$(grep -o -- '--bg-bottom: *#[0-9a-fA-F]\{6\}' assets/site.css | head -1 | grep -o '#[0-9a-fA-F]\{6\}')
if [ -z "$TOP" ] || [ -z "$BOTTOM" ]; then
  fail "could not read the palette tokens from assets/site.css"
elif [ -d ships/2048 ]; then
  if grep -rqi "$BOTTOM" ships/2048/index.html; then
    pass "ships/2048 matches the current palette ($TOP / $BOTTOM)"
  else
    fail "ships/2048 has drifted from the palette ($BOTTOM not found)"
    info "it is generated from the 2048 repo; re-export it after a palette change"
  fi
fi
echo

# ---------------------------------------------------------------- 8
echo "Downloads"
if [ "$OFFLINE" -eq 1 ]; then
  info "skipped (--offline)"
else
  for asset in $(grep -o 'releases/latest/download/[A-Za-z0-9.-]*' ships/scribe/index.html | sed 's|.*/||' | sort -u); do
    code=$(curl -s -o /dev/null -w '%{http_code}' -IL --max-time 30 \
      "https://github.com/daniel-wing/scribe/releases/latest/download/$asset")
    if [ "$code" = "200" ]; then pass "$asset resolves"; else fail "$asset returned $code"; fi
  done
fi
echo

if [ "$FAILED" -ne 0 ]; then
  echo "audit failed"
  exit 1
fi
echo "audit passed"
