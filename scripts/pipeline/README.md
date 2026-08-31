# voteaware data pipeline

Builds voteaware's MP dataset from public sources, replacing the illustrative
mock data in `src/data/mps.ts`. This does **not** pull from andhbhakt.org —
that site's `/mp-mla` feature sits behind Cloudflare Turnstile and a
`Disallow: /` robots.txt, and its backend code isn't in the andhbhakt repo
checkout either. These are independent public sources instead.

## Sources and status — all working and verified

| Source | Script | Records | What it provides |
|---|---|---|---|
| sansad.in | `fetch-sansad.mjs` | 550 (537 unique — see dedup note below) | Roster: name, party, constituency, state, status, terms served |
| prsindia.org | `fetch-prs.mjs` | 544 | Attendance %, debates, questions asked, private member bills |
| myneta.info (ADR) | `fetch-myneta.mjs` | 483 | Winners only: criminal cases, education, declared assets/liabilities |
| myneta.info (ADR) | `fetch-myneta-candidates.mjs` | 7,441 across 483 constituencies | Full per-constituency candidate lists — winner + everyone who lost |
| MPLADS funds | `fetch-mplads.mjs` | 1126 (557 + 569 across two terms) | Fund entitlement/received/spent/unspent, utilization % |
| PC boundaries | `fetch-constituency-boundaries.mjs` | 543 | Lok Sabha constituency shapes (2019 delimitation, CC0) |
| **Merged** | `merge.mjs` | 537 | Roster + PRS + MyNeta + MPLADS joined per MP by constituency |
| **Candidates** | `merge.mjs` | 463/537 MPs have a candidate list | Separate file — see "Wired into the app" |
| **Geo** | `build-geo.mjs` | 36 states, 537/537 MPs mapped | State + per-state constituency shapes for the map — see below |

Match rates in the merged output: 465/537 to PRS, 463/537 to MyNeta, 511/537
to MPLADS, 463/537 to full candidate lists.

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
npm run pipeline:sansad             # ~1 min, paginates the full LS roster
npm run pipeline:prs                # ~5-10 min normally; can run much slower if prsindia.org
                                     # soft-rate-limits after repeated scrapes in one session
                                     # (checkpoints to data/prs-mps.json every 25 MPs, so a
                                     # slow/interrupted run still leaves usable partial data)
npm run pipeline:myneta             # ~few seconds, one page fetch
npm run pipeline:myneta-candidates  # ~10-15 min: 483 candidate-page fetches (plain HTTP) +
                                     # 483 Playwright page loads (one per constituency) — see
                                     # "Full candidate lists" below for why Playwright is needed
npm run pipeline:mplads             # ~few seconds, two CSV downloads
npm run pipeline:merge              # joins everything into data/mps-merged.json + data/mp-candidates.json
npm run pipeline:sync               # copies both into src/data/ for the app to import
npm run pipeline:geo-boundaries     # ~few seconds, one GeoJSON download (CC0, DataMeet)
npm run pipeline:geo-build          # dissolves/joins into src/data/geo/ for the map — see below

npm run pipeline:all      # runs everything above in the right order
```

Output lands in `scripts/pipeline/data/*.json` (gitignored raw dumps). The
committed, app-facing snapshots are `src/data/mps-merged.json`,
`src/data/mp-candidates.json`, and `src/data/geo/` — refresh all three by
re-running `npm run pipeline:all`.

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
- **sansad.in duplicate rows**: for 13 constituencies, the roster scrape
  returned the *same* MP twice under two name formats — `"Lastname, Title
  Firstname"` and `"Title Firstname Lastname"` (e.g. both `"Baalu, Shri T
  R"` and `"Shri T R Baalu"` for Sriperumbudur) — almost certainly a
  pagination-boundary quirk on sansad.in's side. Both rows normalize to the
  same constituency id, so left unfixed every downstream join (and the geo
  map) would silently double that MP. `merge.mjs`'s `dedupeSansad()` keeps
  the comma-free name (the format all ~524 non-duplicated rows already use)
  and drops the other — this is why the roster's raw 550 rows become 537
  unique MPs.

### Full candidate lists (winner + everyone who lost) — MyNeta, via Playwright

`fetch-myneta-candidates.mjs` fetches every candidate who contested each
constituency, not just the winner — party, criminal cases, education, age,
declared assets/liabilities, and an `isWinner` flag. **MyNeta does not
publish vote counts or victory margins anywhere** (verified by checking a
losing candidate's own affidavit page) — it's ADR's affidavit database, not
an election-results site, so this is affidavit data only, never a ranked
results table.

This fetcher uses Playwright instead of a plain HTTP fetch because MyNeta's
`show_candidates` page renders some rows via inline `document.write()` calls
with a custom base64-like obfuscated payload. Decoding a sample by hand
confirmed these obfuscated rows contain the exact same markup as the plain
ones — same category as sansad.in's JS-rendered roster we already handle
this way, not a bot-detection wall (no login, no CAPTCHA, no rate limiting).
A plain fetch silently drops those rows (confirmed: Nagpur has 26 candidates
in the rendered DOM vs. 22 in raw HTML), so Playwright is required for a
complete list here, not optional.

Two-step fetch, because the winners list doesn't expose a `constituency_id`
directly: (1) for each known winner, fetch their `candidate.php` page (plain
HTTP — no obfuscation there) to read the constituency_id off its "view all
candidates" link; (2) render `show_candidates&constituency_id=N` per unique
id and read the fully-rendered table.

### Constituency + state boundaries — DataMeet (CC0)

`fetch-constituency-boundaries.mjs` downloads
`india_pc_2019_simplified.geojson` from
[DataMeet](https://github.com/datameet/maps) — a well-known Indian
open-geodata community project. This specific file is CC0 1.0 Universal
(public domain), created by Arun Ganesh with corrected/crowdsourced
attributes. No Lok Sabha redelimitation happened nationally between 2019 and
2024, so these boundaries are still current — with a few documented
exceptions.

`build-geo.mjs` joins these 543 shapes to `mps-merged.json` by constituency
name (with an explicit alias table for ~28 known renames/spelling
differences — verified against the real per-state name lists in the
boundary file, not guessed), then:

- Derives one dissolved polygon per state/UT (via `@turf/turf`'s
  flatten+dissolve, pipeline-only — never shipped to the browser) with the
  leading party (most seats), seat count, and total unspent MPLADS funds
  baked into its properties → `src/data/geo/states.json`.
- Writes one file per state with that state's individual constituency
  shapes + per-seat MP data, loaded on demand by the UI →
  `src/data/geo/pc/<state-slug>.json`.

**All 537 MPs now have a shape.** Two seats needed special handling:

- `Ladakh` became a separate UT in Aug 2019, after this boundary snapshot,
  so it has no `st_name` of its own — but its constituency polygon *is*
  present, filed under `Jammu & Kashmir`. It was previously being dropped by
  the state-name join, which silently removed 179,000 km² (Leh, Kargil, and
  the whole claimed northern region) from the rendered map. Pointing the
  Ladakh state alias at `Jammu & Kashmir` restores it; it still groups into
  its own state feature, since grouping keys on the MP's state, not the geo
  name.
- `Anantnag-Rajouri` is a new 2022-delimitation seat with no exact shape in
  a 2019 file. It is drawn with the old `Anantnag` polygon — the closest
  real, non-overlapping shape — so the Kashmir valley has no hole in it. The
  shape is therefore slightly smaller than the seat actually is; the MP,
  party, and fund figures attached to it are exact.

**Northern boundary**: this DataMeet file already uses India's official
(Survey of India) depiction. Verified by point-in-polygon test — the Ladakh
constituency polygon contains Gilgit, Muzaffarabad, and Aksai Chin. Nothing
is redrawn or clipped by this pipeline.

Full reasoning and the alias table live in `build-geo.mjs`'s header comment.

## Wired into the app

`src/data/mps.ts` reads `src/data/mps-merged.json` (a committed snapshot,
distinct from the gitignored `scripts/pipeline/data/` scrape output) and
derives the rest at import time:

- `grade`/`gradeNote` — computed only from whichever of attendance % and
  fund-utilization % actually matched for that MP; an MP matching neither
  source gets grade `"N/A"`, never a guessed letter.
- `partyColor` — from `src/data/party-colors.ts`, the single source of truth
  for party colour across the national map, the state panel, and MP pages.
  Every party that leads a state is pinned to a distinct colour so the
  national map can never be ambiguous; the ~30 remaining parties hash into a
  separation-tuned ramp. Colours are deliberately **not** baked into the geo
  files — an earlier copy of this function lived in `build-geo.mjs` as well,
  and both hashing BJP and INC to near-identical purples is what made the
  first version of the map unreadable.
- `photoInitials` — derived from the MP's name.

The UI (`MPDetail.tsx`) shows `fundsDataTerm` next to every fund figure so
it's never presented as the current term's live data, and renders "no
record matched" states explicitly for MPs missing PRS or MyNeta data rather
than hiding the gap.

Candidate lists (`src/data/mp-candidates.json`) are lazy-loaded per MP via
`loadCandidates()` in `src/data/mps.ts` — they're NOT embedded in
`mps-merged.json`, because 7,441 candidate records would add ~2.6MB to a
file every page imports eagerly. `MPDetail.tsx` fetches this file (dynamic
`import()`, so Vite code-splits it into its own chunk) only when a user
opens an MP's page.

The map (`IndiaMap.tsx` on the home page, `StatePanel.tsx` for the
drill-down) reads `src/data/geo/states.json` and, on demand, the relevant
`src/data/geo/pc/<slug>.json` via `import.meta.glob` — same lazy-loading
principle, so visiting `/mps` or an MP's page never pays for map data.
Routes are also lazy-loaded in `App.tsx` (`React.lazy`) so each page's JS
chunk only includes what that page actually needs.

Run `npm run pipeline:sync` after re-running the merge to copy the fresh
`mps-merged.json` + `mp-candidates.json` into `src/data/`, and
`npm run pipeline:geo-build` to refresh the map data — or just use
`npm run pipeline:all`, which runs the entire chain in order.

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
4. No *freely accessible* source provides per-project work items (what the
   old mock data called "works promised/completed") — that section was
   dropped from the MP detail page rather than fabricated. The itemized data
   does exist (work name, sanction amount, status, agency, dates —
   568,330 rows, 2005–2024) but every copy found so far is gated:
   - `mplads.mospi.gov.in` (eSAKSHI) — public dashboard is aggregate-only;
     work-level detail requires an MP/District-Authority login.
   - `dataful.in` — hosts the exact dataset, but the download endpoint
     returned `401` without signing in (paid/account-gated platform).
   - `data.gov.in` — still `Disallow: /` in robots.txt + Akamai-blocked.
   - `data.opencity.in` (our current MPLADS source) only mirrors term-level
     per-MP totals, not itemized works (checked all three of its resources).
   Revisit if a free mirror of the work-level dataset turns up, or if the
   user decides to provide their own dataful.in credentials.
5. `Anantnag-Rajouri` is drawn with the pre-2022 `Anantnag` boundary (see
   "Constituency + state boundaries" above) — swap in the real shape if a
   post-2022-delimitation J&K boundary file turns up freely licensed.
6. The state-level map colors by whichever party holds the most seats in
   that state — for closely contested states this can read as more
   one-sided than the seat count actually is. Consider a "seat share" detail
   (e.g. "BJP 18, INC 12, other 6") in `StatePanel.tsx` if that nuance turns
   out to matter to users.
