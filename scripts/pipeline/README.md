# voteaware data pipeline

Builds voteaware's MP dataset from public sources, replacing the illustrative
mock data in `src/data/mps.ts`. This does **not** pull from andhbhakt.org —
that site's `/mp-mla` feature sits behind Cloudflare Turnstile and a
`Disallow: /` robots.txt, and its backend code isn't in the andhbhakt repo
checkout either. These are independent public sources instead.

## Sources and status — all four working and verified

| Source | Script | Records | What it provides |
|---|---|---|---|
| sansad.in | `fetch-sansad.mjs` | 550 | Roster: name, party, constituency, state, status, terms served |
| prsindia.org | `fetch-prs.mjs` | 544 | Attendance %, debates, questions asked, private member bills |
| myneta.info (ADR) | `fetch-myneta.mjs` | 483 | Criminal cases, education, declared assets/liabilities |
| MPLADS funds | `fetch-mplads.mjs` | 1126 (557 + 569 across two terms) | Fund entitlement/received/spent/unspent, utilization % |
| **Merged** | `merge.mjs` | 550 | All of the above joined per MP by constituency |

Match rates in the merged output: 475/550 to PRS, 475/550 to MyNeta, 522/550
to MPLADS.

### MPLADS: not from mplads.gov.in directly — read this before trusting the numbers

`mplads.gov.in` and `rajyasabha.nic.in` are unreachable from this dev network
at the TCP level (`curl -v` never even completes a connection — not an HTTP
block, the host doesn't respond at all to this network's requests). That's
typical of `.gov.in`/`.nic.in` hosts restricting traffic to Indian IP ranges.

`data.gov.in` (the natural next place to check for a mirror) was also ruled
out: its `robots.txt` disallows all crawling (`Disallow: /`) and it actively
blocks automated browsers with Akamai bot detection — same category as
andhbhakt.org, not something to build a scraper against.

**What actually works**: `data.opencity.in`, a public CKAN "urban data
portal" (OpenCity/DataMeet) that mirrors this same official MPLADS dataset
for civic-tech reuse. Its `robots.txt` only disallows `/api/`, `/revision/`,
`/dataset/*/history`, and `/dataset/rate/` — the dataset pages and CSV
downloads used here are unrestricted, and there's no bot-detection wall.
`fetch-mplads.mjs` pulls two CSVs from it (verified end-to-end, real parsed
numbers, not scaffolding):

- 17th Lok Sabha (2019–2024) — 557 MPs
- 16th Lok Sabha (2014–2019) — 569 MPs

**The catch**: no 18th Lok Sabha (current, 2024–) MPLADS dataset has
surfaced publicly on this mirror, or anywhere else searched, as of this
build. MPLADS fund reporting appears to lag the term by design (funds get
disbursed and reported over a multi-year cycle), so a 2024–29 dataset may
simply not exist publicly yet. `merge.mjs` therefore uses the 17th LS
(2019–2024) figures as the best currently-obtainable proxy, matched by
**constituency, not by MP identity** — for re-elected MPs this happens to be
the same person, for everyone else it's their predecessor's record. Every
merged record carries `fundsDataTerm` (e.g. `"17th Lok Sabha (2019-2024)"`)
so this is never silently presented as the current MP's live figures. Check
`fundsDataTerm` before displaying fund data in the UI, and consider labeling
it explicitly as "most recent available term" rather than "current."

Re-check `data.opencity.in`'s dataset page periodically for an 18th LS
resource:
https://data.opencity.in/dataset/lok-sabha-mp-local-area-development-funds-details

## Running it

```bash
# From voteaware/
npm run pipeline:sansad   # ~1 min, paginates the full LS roster
npm run pipeline:prs      # ~5-10 min normally; can run much slower if prsindia.org
                          # soft-rate-limits after repeated scrapes in one session
                          # (checkpoints to data/prs-mps.json every 25 MPs, so a
                          # slow/interrupted run still leaves usable partial data)
npm run pipeline:myneta   # ~few seconds, one page fetch
npm run pipeline:mplads   # ~few seconds, two CSV downloads
npm run pipeline:merge    # joins all four into data/mps-merged.json

npm run pipeline:all      # runs sansad, prs, myneta, merge in sequence (not mplads yet)
```

Output lands in `scripts/pipeline/data/*.json` (gitignored raw dumps —
decide whether to commit `mps-merged.json` itself once the shape is final
and MPLADS coverage for the current term is settled).

## How the join works

All sources are joined on a normalized constituency name (uppercased,
reservation markers like `(SC)`/`(ST)` stripped) — see
`normalizeConstituency()` in `merge.mjs`. This is a best-effort key, not a
guaranteed one: constituency renames/delimitation, byelections, or
inconsistent spelling between sources can cause misses. Spot-check a sample
of unmatched rows before treating the merged output as fully authoritative.

## Known data-quality caveats

- **sansad.in**: the members page also renders a second, differently-shaped
  table (member profile detail: DOB/party/address) that a generic
  `table tbody tr` selector also picks up once pagination triggers it.
  `fetch-sansad.mjs` filters these out by detecting a YYYY-MM-DD date in the
  `party` cell — fragile but reliable against the current markup. Re-verify
  if the row count drifts far from ~543 in a future run.
- **myneta.info**: the regex-based row parser catches 483/543 rows. The
  remaining ~60 likely use a markup variant not yet accounted for
  (independents, candidates with unusual affidavit formatting, etc.) — not
  investigated further; a DOM-based parser (cheerio) would be more robust
  than the current regex if this needs to be exhaustive.
- **PRS**: attendance/debates/questions/PMB are scraped via CSS-class-based
  regexes tied to Drupal's auto-generated field classes
  (`field-name-field-attendance`, etc.) — verified against a real MP page,
  but Drupal class names can shift between deploys. Also: its index page's
  pagination widget is a JS-hydration placeholder that always claims exactly
  10 pages in the static HTML regardless of the true count — the fetcher
  pages until two consecutive empty results instead of trusting that number.
- **MPLADS**: the 16th and 17th LS CSVs use *different column schemas*
  entirely (`MPName`/`Constituency` vs `MP Name`/`Constituency `, different
  field sets) — `fetch-mplads.mjs` maps each separately rather than assuming
  a shared shape. The CSVs also have a title/metadata block before the real
  header row, and the 16th LS file has quoted fields with embedded commas
  (a "reasons" column) — the parser is a real quote-aware CSV parser, not a
  naive `.split(",")`, specifically because of that.

## Wired into the app

`src/data/mps.ts` reads `src/data/mps-merged.json` (a committed snapshot,
distinct from the gitignored `scripts/pipeline/data/` scrape output) and
derives the rest at import time:

- `grade`/`gradeNote` — computed only from whichever of attendance % and
  fund-utilization % actually matched for that MP; an MP matching neither
  source gets grade `"N/A"`, never a guessed letter.
- `partyColor` — a deterministic hash of the party name to an HSL color, not
  a hand-curated list (there are 30+ distinct party strings in the data).
- `photoInitials` — derived from the MP's name.

The UI (`MPDetail.tsx`) shows `fundsDataTerm` next to every fund figure so
it's never presented as the current term's live data, and renders "no
record matched" states explicitly for MPs missing PRS or MyNeta data rather
than hiding the gap.

Run `npm run pipeline:sync` after re-running the pipeline to copy the fresh
`mps-merged.json` into `src/data/` (or use `npm run pipeline:all`, which now
includes mplads + merge + sync end to end).

## Next steps

1. Watch for an 18th Lok Sabha MPLADS dataset to appear (on
   `data.opencity.in`, `dataful.in`, or elsewhere) and swap its CSV URL into
   `SOURCES` in `fetch-mplads.mjs` — this closes the one remaining accuracy
   gap in the whole pipeline.
2. Decide the constituency-matching strategy for records that don't match
   across sources (currently: fields are left `null`, not estimated or
   fabricated).
3. Consider adding `fetch-rajyasabha.mjs` for full Parliament coverage
   (voteaware currently only covers Lok Sabha via sansad.in) — same TCP
   unreachability problem as mplads.gov.in applies to rajyasabha.nic.in, so
   this needs the same kind of mirror-hunting that solved MPLADS.
4. No source provides per-project work items (what the old mock data called
   "works promised/completed") — that section was dropped from the MP detail
   page rather than fabricated. If a source for itemized MPLADS works
   surfaces, it can be added back for real.
