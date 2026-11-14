# Security Requirements — u1-sim-foundation

> Upstream: `functional-spec.md` (W4/W5 save flows), `rules.md` (BR6.1–BR6.4), `requirements.md` (NFR4: versioned saves, corrupt/unknown versions detected, never silently loaded), `contract-summary.md` (C6 integrity, import order, error vocabulary). The game is offline-first with no backend, no accounts, and no network calls, so there is no authentication, authorization, or transport surface in this unit.

| ID | Requirement | Target | Verdict |
|---|---|---|---|
| NFR4.3 | Save integrity is tamper-evident: any alteration or truncation of the envelope or payload is detected on import. | Synchronous bundled SHA-256 over canonical UTF-8 JSON of every envelope field except `checksum` itself (in-process implementation, not WebCrypto, which is async); mismatch rejects with CHECKSUM_MISMATCH, current save untouched; digest cost is inside the NFR1.4 autosave budget and C6 signatures stay synchronous | Round-trip + tamper tests (flip one byte → named rejection) |
| NFR4.4 | Import executes no code: the save file is data only and can never trigger behaviour beyond state replacement. | Import path uses `JSON.parse` only, then a recursive key scan that rejects `__proto__`, `constructor`, and `prototype` at any depth as INVALID_SHAPE before the ignore-unknown-fields rule runs; no `eval`, no dynamic import | Static check + corrupt-shape import tests (nested `__proto__` payload → INVALID_SHAPE) |
| NFR4.5 | The digest is integrity evidence, not anti-cheat: the algorithm and scope are public and the app runs in the player's browser. | Documented in C6 and in the player-facing export note; no security claim beyond corruption/casual-edit detection | Doc review at the U7 save/load screen |

Out of scope for U1: account security, network security, secret management (no backend, no secrets — Construction phase rule).
