# Tech Stack Decisions — u1-sim-foundation

> Upstream: `requirements.md` (Constraints: PixiJS v8 + Svelte 5 + TypeScript + Vite; offline-first PWA; no backend), `team-practices.md` (TDD, 80% line-coverage floor, CI before merge; Prettier + ESLint; feature branches into `main`). Answers from `nfr-requirements-questions.md` (Q2-A, Q3-A, summary `Looks correct`).

| Choice | Decision | Rationale |
|---|---|---|
| Language | TypeScript (strict) | Pinned by project constraints; the kernel is pure logic with no DOM |
| Build | Vite | Pinned toolchain; Vitest shares its transform pipeline |
| Test runner | Vitest (Q3-A) | Vite-native; TDD red-green-refactor with the 80% line-coverage floor enforced in CI before merge |
| Formatter / linter | Prettier + ESLint | Affirmed team practice; the agent reads the linter config first and only suggests what it doesn't cover |
| Deterministic hashing | Synchronous bundled SHA-256 utility in U1, no new dependency | WebCrypto is async and C6 signatures stay synchronous; digest cost sits inside the NFR1.4 autosave budget |
| Primary store | IndexedDB (Q2-A) |Durability order per C6: write → read-back verify → swap, retry once, then localStorage fallback |
| Fallback store | localStorage (Q2-A) | Only when IndexedDB is unavailable; warn and disable autosave until the next successful write |
| Determinism | Single seeded RNG, no time APIs in systems | NFR3.1/NFR3.2; replay test with golden state |

| ID | Requirement | Target | Verdict |
|---|---|---|---|
| NFR5.1 | Kernel development is test-first with an 80% line-coverage floor and CI gating every merge. | Tests written before code; coverage report ≥ 80% lines; CI blocks merge on test or coverage failure | CI configuration review at the Bolt 1 checkpoint |
