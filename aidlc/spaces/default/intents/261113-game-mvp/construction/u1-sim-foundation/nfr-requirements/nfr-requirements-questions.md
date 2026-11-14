# NFR Requirements — Questions (u1-sim-foundation)

> Unit U1 owns the shared kernel: tick loop, seeded RNG, store, command bus, species data, save/load + autosave, catch-up. Inception NFRs: NFR1 (100 fish ≥ 50 fps, Meizu Lucky 08), NFR2 (WCAG 2.1 AA), NFR3 (seeded determinism), NFR4 (versioned saves + migrations), NFR5 (TDD, 80% line coverage, CI). Stack is pinned: PixiJS v8 + Svelte 5 + TypeScript + Vite; Prettier + ESLint; feature branches into `main`.

## Q1. [NFR] Sim-tick time budget (NFR1 share)

NFR1's full proof (rendered 100-fish scene) lands in U7, but U1's tick must leave frame headroom. This sets U1's measurable tick target on the reference device.

A. One 100-fish tick completes in ≤ 4 ms (p95) on the Meizu Lucky 08, leaving ~12 ms of a 60 fps frame for rendering
B. One 100-fish tick completes in ≤ 8 ms (p95) on the reference device
X. Other (please specify)

[Answer]: B

## Q2. [NFR] Save durability order (NFR4)

C6 already fixes write → read-back verify → swap, retry once, then localStorage fallback. This confirms the requirement-level target.

A. Confirm: IndexedDB primary, localStorage fallback; a save the read-back cannot verify is never swapped to active
B. Change it — say how
X. Other (please specify)

[Answer]: A

## Q3. [NFR] Test runner for the kernel (NFR5)

NFR5 (TDD, 80% line floor, CI before merge) applies to every unit. U1 is pure TypeScript with no DOM. This names the runner its requirements assume.

A. Vitest (Vite-native, matches the pinned Vite toolchain)
B. Other — name it
X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
