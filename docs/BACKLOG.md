# Backlog - Remaining Technical Debt

**Last Updated**: 2026-03-09
**Status**: 640/640 tests passing | TypeScript clean | Lint clean | Biome clean

---
## Open Items

### Consolidate enqueue scripts and search term infrastructure (2026-03-08)

**Context**: Codebase cleanup identified 3 overlapping search term systems with unique data in each. Currently the root-level script is dead code (broken imports).

**Files**:
- `server/src/scripts/one-off-and-test-batches/enqueue-by-category.ts` — dead code (broken `__dirname`, direct `PrismaClient`). Categorizes 5-char terms against 4 dictionaries
- `server/src/scripts/enqueue-batch.ts` + `config/batch-configs.ts` — active, canonical. Config-driven CLI with 18 batch types and priority system
- `server/src/scripts/continuous-batch-scraper.ts` — active, long-running scraper that auto-generates and enqueues terms

**Unique data at risk of loss in `enqueue-by-category.ts`**:
- ~200 curated 5-char first names (not in batch-configs)
- 48 Hispanic surnames: Acuna, Adame, Anaya, Avila, Baeza, Banda, Bello, Bosco, Bravo, Bueno, Calvo, Campo, Casas, Cerda, Chapa, Coria, Corzo, Duran, Garzo, Lerma, Llano, Loera, Lujan, Mares, Marin, Mejia, Mendo, Milla, Monje, Nieto, Oliva, Ozuna, Parra, Ponce, Reyna, Rocha, Rojas, Roque, Saenz, Serna, Tamez, Tello, Tovar, Uribe, Valde, Valez, Viera
- 20 Indian surnames: Bajaj, Bhatt, Batra, Dixit, Joshi, Kapur, Kumar, Mehta, Mehra, Misra, Nagar, Naidu, Nanda, Pande, Reddy, Sethi, Sinha, Sodhi, Verma, Yadav
- 7 Asian surnames: Chang, Hsiao, Huang, Hwang, Jiang, Liang, Tsang
- 29 Texas city names: Alamo, Aledo, Alice, Allen, Bryan, Cisco, Clyde, Crane, Cuero, Donna, Eagle, Elgin, Emory, Ennis, Freer, Hondo, Hutto, Llano, Manor, Marfa, Mason, Mexia, Moran, Olney, Pampa, Pecos, Plano, Tyler, Wells

**Unique features in `batch-configs.ts`**:
- Priority tiering (-100 ultra to 2 standard)
- `HIGH_RESULT_TERM_SPLITS` map — splits high-volume terms (Oak→Oak Hill/Oakwood/..., Maria→Maria E/G/R/L, Estate→Estate of/Estates at/Estate Trust) to avoid truncation

**Research tasks** (4/5 data consolidation complete; remaining: city verification):
1. Determine if Texas city names yield results in TCAD search (cities historically don't work per CLAUDE.md — verify before adding)
2. ~~Consider merging `HIGH_RESULT_TERM_SPLITS` logic into `continuous-batch-scraper.ts`~~ Done — expansion applied in `TermSelector.getNextBatch()` (0e3dede, ea22e48)

---

### Code Review 02-27-2026 of commit 66dc363

  Low
  6. Test vi.resetModules() could leak — DEFERRED: vi.resetModules() in afterEach is load-bearing for await import() pattern; removal breaks 4 tests. Needs per-test vi.isolateModules() refactor. -- `src/__tests__/App.test.tsx:59`

### Code Review 2026-03-09 of commits b24e059, 13d4360, e70920f (backlog-implementer session follow-up)

  Medium
  12. [x] Test call-order comment (lines 44-49) is inconsistent with actual code flow — fixed in c9427d6
  13. [x] Cache invalidation test suite only asserts `mockGroupBy` call counts — added `mockFindMany.toHaveBeenCalledTimes` assertions in c9427d6

  Low
  14. [x] `STOP_AT_PROPERTIES = 420000` missing context — added comment in c9427d6

---

## Completed

All completed items migrated to `docs/changelog/` (per-date files).

**Latest migration**: 3 items migrated to [changelog/2026-03-09.md](../changelog/2026-03-09.md) (TCAD API JSON failures, Documentation Staleness Audit, Documentation Staleness Follow-up)
