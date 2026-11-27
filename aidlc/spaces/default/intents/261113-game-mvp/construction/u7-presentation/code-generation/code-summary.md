# Code Summary — u7-presentation

> Unit `u7-presentation` (U7 Presentation shell: Svelte 5 UI + PixiJS 8 tank
> canvas + composition root + PWA shell over the read-only store and command
> bus; all screens W36–W49). TDD red-green-refactor throughout (Steps 3–12);
> Standard volume + mvp 80% line floor. This is the retry build: the prior
> attempt left shell-glue gaps that failed review twice, so every glue point
> below is an explicitly tested requirement (boot mounts the Svelte shell,
> App owns away/fault modal state, store reads frozen, no discarded
> outcomes, preview/eligibility mirrors, factory prop forwarding, memoizing
> selectors, notify-on-change resync).
>
> Consumes the LANDED v2 shape and all six sim units (U1 store/registry +
> U2–U6 `register()` entry points, selectors, commands, SaveLoadApi). No sim
> changes. Depends on U2–U6 only after batch 2 converged (U7 codes last).

## Files

Created (`packages/u7-presentation/`):

- `package.json` — `@aquarium/u7-presentation`, ESM; depends on all six
  sim units plus `pixi.js@^8.23.0` + `svelte@^5.59.1` (prod) and
  `@sveltejs/vite-plugin-svelte` + `vite-plugin-pwa` + `axe-core` +
  `jsdom` (dev/test). Lockfile committed at the worktree root.
- `tsconfig.json` — extends the root config, scoped to this package.
- `src/index.ts` — public barrel (store, boot, selectors, outcomes, away,
  fault, tank math, helpers, actions, save menu).
- `src/svelte-shim.d.ts` — ambient `*.svelte` declaration so `tsc --noEmit`
  accepts `import App from './App.svelte'` (bodies are compiled by the
  Svelte plugin under vitest, which mounts the real shell).
- `src/main.ts` — browser entry (W47): `createAppKernel()` then
  `mount(App, { target: #app })`; fails loudly without the mount root.
- `src/App.svelte` — composition root: all 13 screens always mounted
  (inactive ones `hidden` so tab state survives), plus AwaySummaryModal,
  ConfirmDialog, FaultBoundary. Owns the away modal state (set by the
  catch-up) and the fault subscription; drives the frame loop
  (driveTick → resync → snapshot) on a 1 s interval.
- `src/shell/boot.ts` — `createAppKernel` (W47; C2/C5/C6): kernel from the
  U1 factory, all six `register()` calls (order imposes no sim order —
  U1 sorts by phase), `assertExhaustive`, shell store; species load in
  prod mode (invalid excluded + logged, never a crash). `readSeed`
  (deterministic default + `?seed=` override, no wall-clock entropy).
- `src/shell/store.ts` — read-only binding (C1; W38): frozen snapshot
  rebuilt at most once per store version (no per-tick re-read), deep
  freeze over every selector result (mutation attempts throw; kernel
  state shares no references), version-gated memoization (same ref while
  the version is unchanged, `snapshot()` takes no selector argument so
  inline closures cannot defeat the cache), `resync()` notifies only on
  change, dispatch wrapper resyncs after the bump (U1 drains subscribers
  before bumping, so the tick path also defers one microtask).
- `src/shell/settings.ts` — `buildSettingsUpdate` diff (W38/W49):
  changed fields only, null when nothing changed so callers skip the
  dispatch (no version bump for a no-op edit).
- `src/shell/selectors.ts` — named module-level views (selectHud,
  selectFishList, selectRoster, selectStoreContext, selectFeeding,
  selectBreeding, selectOrders, selectTank, selectTankScene,
  selectSettings, selectBell, selectSaveContext). Panels bind these;
  only App subscribes.
- `src/shell/outcomes.ts` — `errorMessage` (handler text tagged with its
  code, fallback per code) + `outcomeMessage` (ok → null/refresh,
  err → named message at the originating row).
- `src/shell/away.ts` — `runAwaySequence` (catch-up → modal model, null
  when no offline hours) + `resumeFromAway` (setPaused false → speed 1
  per U1 BR1.2). Modal state lives in App, not here.
- `src/shell/fault.ts` — tick-abort hub (W46; C2): `checkFault` poll,
  `watchFaults`/`notifyFault` (emit on change only), `driveTick`
  (tick + poll so the panel CAN trigger), `reloadToAutosave` (newest auto
  slot via the SaveLoadApi — never a rollback; clears fault + halt).
- `src/shell/store.ts` consumers: `src/panels/*.svelte` (13) + `src/modals/*`.
- `src/tank/steering.ts` — allocation-free boids (W36; BR20): SoA
  Float32Arrays owned by the world, arrive-falloff cohesion, water drag,
  bounded dart bursts (full motion only), deterministic injected time.
- `src/tank/lighting.ts` — `tintFor` (continuous day/night), `snappedTint`
  (exactly 3 stops for reduced motion), `tintHex` (canvas background).
- `src/tank/sprites.ts` — procedural token map (palette/pattern/fin
  verbatim + stable per-fish variant).
- `src/tank/pixiStage.ts` — Pixi lives ONLY in TankCanvas mount (W36):
  injectable factories, lazy production import, soft-fail fallback
  without WebGL; background/width/height forwarded, never hardcoded.
- `src/panels/helpers.ts` — selection set ops (new-set semantics),
  formatMoney/formatCountdown/formatGameTime, preview pass-throughs
  (bulk/order/grade delegate to the sim selectors unchanged).
- `src/panels/actions.ts` — one function per panel row (W38–W44, W48–W49)
  over the real bus via the shell store; ok carries the value (caller
  refreshes), err carries the named message. Bulk-sell names skipped
  fish; settings skips no-op edits.
- `src/save/menu.ts` — SaveLoadApi model (W44; C6): never the bus;
  STALE_SAVE → needsConfirm (never silent overwrite), corrupt/invalid
  imports name the code with the current save untouched.
- 13 `src/panels/*.svelte` — Hud, Toolbar, TankCanvas, FishPanel,
  RosterPanel, StorePanel, FeedingPanel, BreedingPanel, OrdersPanel,
  TankPanel, SavePanel, SettingsPanel, BellPanel. Each bound to store
  selectors + dispatch with row-level messages and `data-testid`s.
- 3 `src/modals/*.svelte` — AwaySummaryModal (W45), ConfirmDialog
  (W44), FaultBoundary (W46, reload-only).

Root shell (touched by this unit):

- `index.html` — `#app` mount root + module script.
- `vite.config.ts` — Svelte plugin + PWA manifest (offline-first shell).
- `vitest.config.ts` — Svelte plugin for the shell compile + `browser`
  resolve condition so `mount` resolves to the client build under vitest
  (no other package imports `.svelte`; their suites re-ran green).
- `eslint.config.js` — untouched (no Svelte plugin; `.svelte` files are
  outside the linted `*.ts` globs and are compiled by vitest instead —
  deviation from the plan recorded here).

Tests (`packages/u7-presentation/tests/`, 80 tests):

- `store.test.ts` (18) — surface (read + dispatch only), live selector
  values, deep-freeze pins (top-level + nested + array, throw on
  mutation, kernel state survives, no shared refs), memoization
  (same ref, zero-arg snapshot, rebuild per accepted dispatch, rejected
  dispatch silent), resync (silent when unchanged, once per dispatch,
  picks up direct ticks, unsubscribe), settings diffs (+ autoPause).
- `render.test.ts` (15) — separation/alignment/cohesion, zero
  Array/Float32Array construction over 50 hot frames (constructor-count
  probe), reduced-motion dart cap, noon-vs-midnight luminance, smooth
  hourly gradient, 3 snapped stops, sprite token mapping + determinism,
  selection/format helpers, preview pass-through equality.
- `dispatch.test.ts` (20) — outcome mapping for all 8 error codes +
  fallbacks, every panel row through the real kernel (buy/sell/bulk
  totals equal the preview with sick skips named, fulfil pays the
  preview, pair/unpair/grade incl. eggs-not-ready, water/equipment/tier
  with unlock + funds names, feeding rows incl. device gating, clock +
  settings with no-op skip), save menu (STALE_SAVE confirm, corrupt
  import untouched, delete, stale-import confirm).
- `boot.test.ts` (17) — six registers + exhaustive catalogue + all six
  system ids, all 13 screens mounted, main.ts wiring (source pins),
  App composition (16 imports), Pixi instantiation through injected
  factories with derived background, WebGL soft-fail, C5 exclusion,
  30-species Store rows, panel selector discipline (only App
  subscribes), readSeed branches, canvas attach, away-null, fault hub
  edge (no fault → null, missing autosave → SLOT_NOT_FOUND), public
  barrel, main.ts real mount, axe audit (0 violations, contrast
  excluded: jsdom has no layout).
- `integration.test.ts` (4) — away full path (modal in App → Resume →
  speed 1/unpaused), fault full path (boom → panel → reload-to-autosave
  restores money, clears fault/halt, `load` called), bell focus
  (notification → Tank tab + canvas focus + fish panel), preview/
  eligibility mirror (eligible pays preview, sick rejects both).
- `benchmark.test.ts` (6) — render p95 ≤ 12 ms @100 fish, reduced
  within 5% of full (+ noise floor), heap < 256 KB/1000 frames
  (informational), sim p95 ≤ 20 ms @x1, x4 burst p95 ≤ 20 ms, 240-tick
  soak (delta 240, max frame ≤ 50 ms, zero dropped).

## Decisions

- Svelte components are thin: all outcome logic lives in tested TS
  modules; `.svelte` files wire events → actions → selectors. tsc never
  sees `.svelte` bodies; vitest compiles them when mounting the real App.
- store `snapshot()` returns frozen aggregates, not `GameState` — panels
  cannot write through the view by construction. Species-dependent
  prices/previews read `kernel.store.state` through the sim's own pure
  selectors (read-only use; writes travel only through `dispatch`).
- U1 drains subscribers before bumping the version; the store therefore
  resyncs post-dispatch in the wrapper and on a deferred microtask for
  tick paths (plus the App loop calls `resync()` after every batch).
- Faults never drain, so the fault path is poll-after-frame through the
  hub — `driveTick` is the single frame driver for App and tests.
- Catalogue content (30 species JSON) is not authored here: boot takes
  `speciesFiles` (default empty); the suite uses 1–2 fixture species
  except the Store 30-row test, which generates 30 valid entries
  programmatically. Full-page keyboard walkthrough stays manual (not
  executed — jsdom has no layout/focus model); the component-level axe
  audit runs green in this unit's suite.

## Coverage

- `npx vitest run --coverage packages/u7-presentation`: U7 TS sources
  96.7% lines (781/808); every module ≥ 80% except `save/menu.ts`
  defensive branches (STORAGE_UNAVAILABLE export catch, confirm-import
  error arm). Global 80% thresholds trip on this unit-scoped run only
  because sim packages run at 0% without their suites; the assembled
  full suite (sim 258 + U7 80) is what Build and Test judges.
- `npx tsc --noEmit` clean; `npx eslint
  packages/u7-presentation/src packages/u7-presentation/tests` clean.
- `npx vitest run packages/u7-presentation`: 6 files, 80 tests, all green.
- Sim suites re-ran green after the shared `vitest.config.ts` change
  (u1–u3: 126; u4–u6: 132): the Svelte plugin + browser condition do not
  affect packages that never import `.svelte`.
