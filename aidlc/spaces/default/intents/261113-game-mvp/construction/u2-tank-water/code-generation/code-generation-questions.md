# Code Generation Plan Approval

AI-DLC writes this file when it asks you to approve the plan. To answer here
instead of in chat, write your answer after `[Answer]:` and tell me in chat when you are done.

## Plan Approval

Approve these 5 code plans?

- Builds: U2 Tank & Water library (water system, equipment/tier commands, selectors, events) plus the v1→v2 migration executing the breaking-change register
- Touches: `packages/u2-tank-water/` (new); `packages/u1-sim-foundation/src/types.ts`, `persistence/persistence.ts` (Tank alignment + migration + barrier); `contract-summary.md` C1 Tank row
- Tests: 5 files, ~30 tests (unit + command-bus integration + migration + benchmark probe)

Full plan: aidlc/spaces/default/intents/261113-game-mvp/construction/u2-tank-water/code-generation/code-generation-plan.md
Test instructions: aidlc/spaces/default/intents/261113-game-mvp/construction/u2-tank-water/code-generation/unit-test-instructions.md

[Approval Fingerprint]: sha256:v3:1d9809fbd6e411fed99679af374c962c7c81630e41a83029d2d7a690aee67f76
[Planned Source]: 0dfb0564eb07d2688f79abb61cc265e16dc08ea9846889201b363a681c811ded

- A. Approve all
- B. Request Changes
- C. I'll edit the files

[Answer]:
