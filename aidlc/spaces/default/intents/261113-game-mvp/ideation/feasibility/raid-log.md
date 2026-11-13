# RAID Log

> Upstream: `intent-statement.md` — success metrics and scope boundary drive the risk list.

## Risks

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | Rendering performance (150 fish ≥ 50 fps) not met on the reference device | Medium | High | Validate first with a benchmark scene | Solo |
| R2 | Procedural sprite scope grows beyond the texture budget | Medium | Medium | Quantize phenotypes; cap the atlas | Solo |
| R3 | Save bloat or corruption in late game | Low | High | Versioned schema + migrations; autosave + export | Solo |
| R4 | Determinism drift (hidden randomness) breaks balance tests | Low | Medium | Seed-only RNG; replay test | Solo |

## Assumptions

- The developer is comfortable with the full proposed stack (confirmed).
- "Mid-range phone" means a Meizu Lucky 08 (confirmed).
- No backend is required for the MVP (confirmed).
- The MVP boundary holds: advanced genetics, remaining breeding archetypes, disease/medicine, full aquascaping, and the multi-tank farm are out of scope (confirmed in the intent statement).

## Issues

None open.

## Dependencies

None external — no integrations, no cloud accounts, no third-party services.
