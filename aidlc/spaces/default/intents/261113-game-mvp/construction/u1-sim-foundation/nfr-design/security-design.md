# Security Design — u1-sim-foundation

> Upstream: `security-requirements.md` (NFR4.3–NFR4.5), `reliability-requirements.md` (NFR4.1, NFR4.2, NFR3.2), `tech-stack-decisions.md`, `functional-spec.md` (W2, W4–W6), `contract-summary.md` (C2, C6). Answers from `nfr-design-questions.md` (Q1-A, Q2-A, summary `Looks correct`).

## Threat model

The game is an offline single-player browser app with no backend, accounts, or network. The attacker is the player holding their own save file; the goal is integrity evidence (detect corruption and casual edits), explicitly not anti-cheat (NFR4.5). There is no authentication, authorization, transport, or secret surface in U1.

## Digest utility (NFR4.3, Q1-A)

- A small synchronous SHA-256 utility bundled inside U1 (`persistence/digest`), zero dependencies, audited once. Sync because C6 signatures stay synchronous (WebCrypto is async and would force a breaking API change).
- Operates on the canonical UTF-8 JSON of the envelope (keys sorted, no insignificant whitespace, shortest round-trip numbers). Cost sits inside the NFR1.4 autosave budget (≤ 50 ms wall for a 100-fish save).
- The canonical form is pinned as `canonicalJson(value)`: recursive key sort at every object depth, UTF-8 encoding, no whitespace, numbers via shortest round-trip text. The same function feeds both digest computation paths (write and import), so the two can never drift.
- The digest is computed at write and recomputed at import; comparison is constant-structure (fixed-length hex strings), timing side-channels are out of scope for a local save file.

## Import validation (NFR4.4)

- `JSON.parse` only — no `eval`, no dynamic import, no prototype mutation.
- Before the ignore-unknown-fields rule runs, a recursive key scan rejects `__proto__`, `constructor`, and `prototype` at any depth with INVALID_SHAPE.
- The fault-halt handshake below never persists: the fault descriptor is memory-only by construction.

## Fault containment handshake (NFR4.2, Q2-A)

- On a throwing system, the tick loop halts (no further ticks queue) and the half-mutated store is discarded — never rolled back in place, never ticked on.
- The kernel records a memory-only fault descriptor `{ tick, systemId, message }`, exposed via the `getFault()` accessor (`FaultDescriptor | null`, retained until reload replaces the store); on the next frame U7 polls it and offers reload-last-autosave. The descriptor is not part of `GameState`, is never serialized, and dies with the reload.
- Blast radius: a fault stops simulation only; the last autosave is always loadable, so worst-case loss is progress since the last autosave (~30 s).

## Determinism enforcement (NFR3.2)

- Banned APIs (`Math.random`, `Date.now`, `performance.now`, `new Date()`, `crypto.getRandomValues`, `crypto.randomUUID`) are rejected by an ESLint `no-restricted-properties` + `no-restricted-globals` rule in the repo eslint config; human review is the backstop. The single seeded RNG is the only entropy source in systems and handlers.
