# Contract Design — Questions

> These pin the contracts that cross a boundary in the aquarium game: the interfaces between U1 and the simulation units, the command and event surfaces U7 uses, and the one artifact that leaves the app (the exported save). We already agreed the mechanism is a single shared store with a command pattern and a typed event bus (Units Generation Q5); these questions settle the details that the summary has to state.

## Q1. [Architecture] External surface — what counts as a public contract

The game has no backend and makes no network calls, so there is no HTTP API. The only thing that leaves the app is the JSON save the player exports, and the JSON they import back. This decides whether the summary promises that format will keep working across app updates.

A. The exported JSON save is the only external contract — documented, versioned, and importable by later versions of the game (a backup made today must still load after an update)
B. The exported JSON save is a best-effort backup only — no stability promise beyond the version that wrote it
C. There is no external contract at all — only the internal boundaries between units matter
X. Other (please specify)

[Answer]: A

## Q2. [Developer] Failed and rejected commands

Every player action (buy, feed, sell, upgrade) reaches the simulation as a command. This decides how a rejected action (not enough money, tank full, sick fish unsellable) is reported to the UI and whether the store can be left half-changed.

A. The command returns a typed result — success with a value and the events it produced, or failure with a code and a human-readable reason — and a rejected command changes no state and emits no events
B. A rejected command throws a typed error, and the caller catches it
C. The UI validates before dispatching, and commands assume their input is already valid
X. Other (please specify)

[Answer]: A

## Q3. [Developer] Where simulation events live during a tick

Feeding, water, fish, breeding and commerce each produce events (a fish died, a brood hatched, an order expired). Notifications, UI and audio consume them. Units Generation left open where events are held during a tick and when consumers see them.

A. Each tick gets a fresh event buffer; systems append to it; after the last phase (notify) the event bus drains the buffer once and notifies subscribers, then clears it
B. Each event is dispatched to subscribers immediately, as the system emits it
C. Systems return their events and the tick registry collects them, then drains them after the tick
X. Other (please specify)

[Answer]: A

## Q4. [Architecture] Changing a contract during the MVP

You are a solo developer and balancing will keep changing commands, events and the save shape. This sets what is safe to change and what needs a version bump, so the contract summary can state the rule.

A. Additive-only within the MVP (new commands, new event variants, new optional fields are fine); renaming or removing a field, or changing what one means, bumps the save schema version with a migration and is recorded in the summary
B. Anything can change at any time — update every call site in the same commit
C. Additive-only everywhere, including the save schema, with no breaking change until after the MVP
X. Other (please specify)

[Answer]: A

## Q5. [Architecture] Who owns a shared type, and how a unit adds a new command or event

U1 owns the shared entity types, the `System` interface, the command bus and the event union. Each simulation unit adds its own commands and events. This decides how that addition happens without every unit having to edit U1's core files.

A. U1 owns the base types and the union declaration; a unit defines its own command and event types in its own folder and appends one line to the union in U1 (an additive, reviewed change)
B. Each unit declares its own types and the union is assembled automatically (for example TypeScript module augmentation), so U1's file never changes
C. Every command and event is defined centrally in U1; units only implement the behaviour
X. Other (please specify)

[Answer]: B 

## Q6. [Developer] The species catalogue data contract

The 30 species (price, size, lifespan, maturity, diet, breeding archetype, genes, palette) are read by tank/water, fish, breeding and commerce. This decides whether the catalogue is data or code, and how a malformed entry is caught.

A. A JSON data file with a fixed schema, validated when it loads; a content version field; an invalid entry fails loudly in development and falls back safely in production
B. A TypeScript module typed `as const` — checked at compile time, with no runtime validation
C. A JSON file with TypeScript types generated from it, and a schema check in the tests only
X. Other (please specify)

[Answer]: A

## Q7. [Developer] Save, import, and storage failure behaviour

Saves go to IndexedDB with a localStorage fallback, and the player can import a JSON backup. The contract must say what happens on a corrupt file, an unknown schema version, and a failed write (quota, private browsing).

A. Strict: malformed JSON or an unknown/newer schema version is rejected with a named error and the current save is untouched; migrations run forward only; a failed write retries once, then falls back to localStorage and warns the player
B. Lenient: an import fills in defaults for anything missing and accepts unknown fields
C. Reject only malformed JSON; accept any object shape and migrate best-effort
X. Other (please specify)

[Answer]: A + X: Add Cryptographic validation, timestamp to prevent tamper. Add logic to detect save tamper.

## Q8. [Security] What the tamper check actually is

Your Q7 answer adds cryptographic validation, a timestamp, and tamper detection on top of the strict behaviour. One thing needs pinning: the game is offline and every byte of the app runs in the player's own browser, so any check shipped inside it can be read and worked around by a determined player — there is no server to hold a secret. This decides what the save file carries and what the summary can honestly promise.

B. Integrity digest plus rollback detection (Recommended) — the save carries a SHA-256 digest of its payload and a save timestamp; import recomputes the digest and rejects a mismatch, and a last-seen save time kept in the browser flags a save that would roll progress backwards. Detects corruption, casual hand-editing and stale-save restores, with no secret key and no anti-cheat claim.
A. Integrity digest only — the save carries a SHA-256 digest and a save timestamp; import recomputes the digest and rejects a mismatch. Simplest form of cryptographic validation; does not detect restoring an older valid save.
C. Per-install signed saves — a Web Crypto HMAC keyed by a per-install secret kept in IndexedDB, so a save edited by another tool fails verification. The key lives in the same browser, so it does not stop the player editing their own save, and it adds key management and a save that is bound to one install.
D. All three — digest, rollback flag and per-install signature together, accepting the extra complexity and the limit that none of it is anti-cheat against the player themself.
X. Other (please specify)

[Answer]: B

---

## Consolidated Summary Confirmation

- **External contract (Q1)** — the exported JSON save is the only external contract: documented, versioned, and later versions of the game must import saves written by earlier ones.
- **Commands (Q2)** — every command returns a typed result; success carries the value and the events it produced, failure carries a code and a human-readable reason; a rejected command changes no state and emits no events.
- **Events (Q3)** — each tick gets a fresh event buffer; systems append to it; after the notify phase the event bus drains it once, notifies subscribers, then clears it.
- **Change policy (Q4)** — additive-only within the MVP (new commands, event variants, optional fields); renaming, removing or re-meaning a field bumps the save schema version with a migration and is recorded in the contract summary.
- **Ownership (Q5)** — each unit defines its own command and event types in its own folder; the shared union is assembled automatically (TypeScript module augmentation), so U1's core declaration is not edited for each addition.
- **Species catalogue (Q6)** — a JSON data file with a fixed schema and a content version, validated when it loads; an invalid entry fails loudly in development and falls back safely in production.
- **Save and import (Q7 + Q8)** — strict: malformed JSON or an unknown/newer schema version is rejected with a named error and the current save is untouched; migrations run forward only; a failed write retries once, then falls back to localStorage and warns the player. The save carries a SHA-256 digest of its payload and a save timestamp; import recomputes the digest and rejects a mismatch, and a last-seen save time kept in the browser flags a save that would roll progress backwards. No secret key and no anti-cheat claim.

Does this all look correct before I write the contract summary?

- Looks correct
- Request changes

[Answer]: Looks correct
