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
| trus | 200 | 27,378 | 620 (after a token-expiry retry) |
| llc. | 200 | 53,899 | 2,316 |
| lane | 504 | — | **permanent** — see below |
| aust | 504 | — | **permanent** — see below |

Running all ten saved **3,676 properties the blacklist had been suppressing**.

**Why the original diagnosis was wrong.** The 2026-08-07 evidence was "every
five-letter expansion of this root failed", which reads as a root-specific bug
but is equally consistent with a transient API outage: expansions attempted
inside a bad window all fail together, and the roots implicated are simply
whichever ones were being expanded at the time. That the *whole* implicated set
recovered together, while `way*` did not, favours the outage reading. Either
way the entries were stale, and staleness here is self-concealing — a
blacklisted root's searches never run, so nothing ever contradicts the entry.

### `lane` / `aust` — a second, distinct failure

Initially read as a load-dependent timeout that belonged in retry handling.
**That was wrong.** Retested at `pageSize=500`, `250`, `100` and `1`, in both
2025 and 2026: HTTP 504 every time, after a consistent ~10s. Payload size is
irrelevant — the timeout is on the query itself — so no page size and no retry
budget reaches these terms. `lanb` returns the 204 in 0s, confirming the two
modes are distinct rather than one flaky behaviour.

Both stay in `TRUNCATION_BUG_ROOTS`. `aust` matters most: it is the prefix of
`austin`, so leaving it out re-enables ~26 doomed expansions of the single most
common local term on every backfill run.

**Bar for adding a root:** a *reproducible* server-side refusal — a 204, or a
504 that survives dropping the page size to 1. Not a one-off failure. Each
entry permanently removes ~26 a-z expansions from every future backfill run.

---

## Confirmed unusable

### HTTP 204, empty body

| Term | Length | Status | Notes |
|------|--------|--------|-------|
| Wayg | 4 | **confirmed** | 20/20 five-letter expansions failed (2026-03-02); 204 reconfirmed 2026-08-08 |
| Wayh | 4 | **confirmed** | 204 confirmed 2026-08-08 |
| Wayi | 4 | **confirmed** | 204 confirmed 2026-08-08 |
| Wayj | 4 | **confirmed** | 204 confirmed 2026-08-08 |
| LMTD | 4 | **confirmed** | 204 confirmed 2026-08-08 (was "untested"). Deliberately *not* in `TRUNCATION_BUG_ROOTS`: that set only suppresses a-z expansion of analytics roots, and nothing expands `lmtd` |

### HTTP 504, ~10s, any page size

| Term | Length | Status | Notes |
|------|--------|--------|-------|
| Lane | 4 | **confirmed** | 504 at pageSize 500/250/100/1, years 2025 and 2026 (2026-08-08) |
| Aust | 4 | **confirmed** | 504 at pageSize 500/250/100/1, years 2025 and 2026 (2026-08-08). Blocks `austin`, so "Austin" itself is unsearchable and city-wide sweeps are not a shortcut to coverage |

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
