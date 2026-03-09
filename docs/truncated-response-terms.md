# Truncated Response Terms

Search terms that failed with "Unexpected end of JSON input" from the TCAD API.

**Root cause**: NOT result set size. Tested by expanding "Wayg" into 20 five-letter
terms (Wayga–Waygt) on 2026-03-02 — all 20 failed with the same truncated JSON error.
The TCAD API itself returns malformed/truncated responses for these prefixes regardless
of specificity. Likely a server-side issue (e.g., timeout, encoding bug, or corrupt
data in matched records).

**Action**: These terms need a different scraping strategy — either response-stream
buffering or skipping until the TCAD API is fixed. Prefix expansion alone does NOT
resolve the issue.

**Last updated**: 2026-03-02

| Term | Length | Status | Notes |
|------|--------|--------|-------|
| Belterra | 8 | blocked | Long term — not a size issue |
| Fiduciary | 9 | blocked | Long term — not a size issue |
| Lakeline Boulevard | 19 | blocked | Long term — not a size issue |
| LMTD | 4 | untested | Try 5-letter expansion, but may hit same API bug |
| Maple Run | 9 | blocked | Long term — not a size issue |
| Mesa Park | 9 | blocked | Long term — not a size issue |
| Nonprofit | 9 | blocked | Long term — not a size issue |
| Pemberton Heights | 17 | blocked | Long term — not a size issue |
| Residential Builders | 21 | blocked | Long term — not a size issue |
| Sendero Springs | 15 | blocked | Long term — not a size issue |
| Wayg | 4 | **tested** | 20/20 five-letter expansions failed — API-side bug |
| Wayh | 4 | untested | Likely same API bug as Wayg |
| Wayi | 4 | untested | Likely same API bug as Wayg |
| Wayj | 4 | untested | Likely same API bug as Wayg |
