# Empty-Response Terms (formerly "Truncated Response Terms")

Search terms the TCAD API cannot serve. The observed symptom is
"Unexpected end of JSON input"; the cause is **HTTP 204 with a zero-byte
body**, so `JSON.parse("")` throws. The response is empty, not cut short —
"truncation" was a misreading of the exception, and the name survives only in
`TRUNCATION_BUG_ROOTS` for continuity.

**Root cause**: not result-set size. Expanding `Wayg` into 20 five-letter terms
(Wayga–Waygt) on 2026-03-02 produced the same failure for all 20, and the 204
still reproduces exactly. Server-side, and specific to a handful of prefixes.

**Last updated**: 2026-08-08 — **12 of the 15 roots were retested against the
2026 roll at production page size (`pageSize=1000`) and 10 of them work.** See
the correction below; the code set is now `wayg`/`wayh`/`wayi`/`wayj` only.

---

## 2026-08-08 correction

The 2026-08-07 entries recorded nine roots as "tested — N/N five-letter
expansions failed". Retested one day later, every one of them returns **HTTP
200 with valid JSON**:

| Root | HTTP | TCAD matches (2026) | New properties when run |
|------|------|--------------------:|------------------------:|
| chri | 200 | 9,751 | 332 |
| cong | 200 | 2,522 | 353 |
| cree | 200 | 10,279 | 148 |
| davi | 200 | 12,050 | 4 |
| lama | 200 | 2,735 | 9 |
| laur | 200 | 5,460 | 217 |
| mana | 200 | 2,844 | 139 |
| nguy | 200 | 2,983 | 158 |
| trus | 200 | 27,378 | (token expiry; re-run) |
| llc. | 200 | 53,899 | not yet run |
| lane | 504 | — | timeout, not a permanent fault |
| aust | 504 | — | timeout, not a permanent fault |

Running the nine saved **1,360 properties the blacklist had been suppressing**.

**Why the original diagnosis was wrong.** The 2026-08-07 evidence was "every
five-letter expansion of this root failed", which reads as a root-specific bug
but is equally consistent with a transient API outage: expansions attempted
inside a bad window all fail together, and the roots implicated are simply
whichever ones were being expanded at the time. That the *whole* implicated set
recovered together, while `way*` did not, favours the outage reading. Either
way the entries were stale, and staleness here is self-concealing — a
blacklisted root's searches never run, so nothing ever contradicts the entry.

**Bar for adding a root:** a reproducible HTTP 204. Not a timeout, not an
intermittent error. Each entry permanently removes ~26 a-z expansions from
every future backfill run.

---

## Confirmed unusable (HTTP 204, empty body)

| Term | Length | Status | Notes |
|------|--------|--------|-------|
| Wayg | 4 | **confirmed** | 20/20 five-letter expansions failed (2026-03-02); 204 reconfirmed 2026-08-08 |
| Wayh | 4 | **confirmed** | 204 confirmed 2026-08-08 |
| Wayi | 4 | **confirmed** | 204 confirmed 2026-08-08 |
| Wayj | 4 | **confirmed** | 204 confirmed 2026-08-08 |
| LMTD | 4 | **confirmed** | 204 confirmed 2026-08-08 (was "untested"). Deliberately *not* in `TRUNCATION_BUG_ROOTS`: that set only suppresses a-z expansion of analytics roots, and nothing expands `lmtd` |

## Long terms that failed, cause unconfirmed

These predate the 204 diagnosis and were never retested; "blocked" here means
"a search failed once", which the correction above shows is weak evidence.

| Term | Length | Status |
|------|--------|--------|
| Belterra | 8 | blocked |
| Fiduciary | 9 | blocked |
| Lakeline Boulevard | 19 | blocked |
| Maple Run | 9 | blocked |
| Mesa Park | 9 | blocked |
| Nonprofit | 9 | blocked |
| Pemberton Heights | 17 | blocked |
| Residential Builders | 21 | blocked |
| Sendero Springs | 15 | blocked |
