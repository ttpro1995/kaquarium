# Evidence

## What I inspected

- **`aidlc/spaces/default/memory/org.md`** — the source of the five suggested
  defaults (Way of Working, Walking Skeleton, Testing Posture, Deployment, Code
  Style). Read as suggested defaults, not established team facts.
- **`aidlc/spaces/default/memory/team.md`** — checked for prior affirmed content
  as re-run context. All five matching sections are empty (template comments
  only), so there was no affirmed baseline to reuse.
- **`aidlc/spaces/default/memory/project.md`** — checked for project-specific
  specialisation. Empty template; nothing narrower than `org.md` exists to draw
  from.
- **`aidlc/spaces/default/intents/261113-game-mvp/aidlc-state.md`** — confirmed
  Project Type `Greenfield`, Scope `mvp`, Collaborators `off` (so the lead works
  alone and no support-agent contributions are produced).
- **`.aidlc/scopes/aidlc-mvp.md`** — confirmed the active scope declares
  `skeleton: on`, which the `org.md` Walking Skeleton default keys on, and that
  the `mvp` scope adds an 80% line-coverage floor with CI execution before merge.

## Interview decisions (affirmed)

The human confirmed the following five practices, which now replace the draft
proposals in `team-practices.md`:

1. **Way of Working — feature branches.** One branch per change, merged back to
   `main` via a review. Integration branch is `main`. Alternative considered and
   rejected: trunk-based development with squash-merged Bolt worktrees (the
   `org.md` default). The human chose the reviewed feature-branch flow instead.
2. **Walking Skeleton — on.** Build a thin end-to-end slice first, then flesh out
   the features. Alternative considered and rejected: skipping the skeleton and
   building feature-by-feature. The scope's `skeleton: on` setting is consistent
   with the human's choice.
3. **Testing Posture — test-first (TDD).** Write tests before the code; the MVP
   keeps an 80% line-coverage floor and CI execution before merge. Alternative
   considered and rejected: test-after (the `org.md` default), where tests are
   written after each layer is implemented. The human chose a stricter,
   test-first ordering.
4. **Deployment — staging on merge, production behind a manual go-ahead.**
   Every merge deploys to a staging spot automatically; promotion to production
   requires a separate human approval. Alternative considered and rejected:
   continuous deployment to production on every commit, which `org.md` describes
   as a later team decision once coverage and observability mature.
5. **Code Style — defer to the language's standard formatter/linter.** Prettier
   and ESLint for TypeScript (or the language-default equivalents), with
   language-idiomatic naming and no project-wide rename rules. Alternative
   considered and rejected: inventing project-wide style rules before the stack
   is pinned.

No hard ALWAYS/NEVER constraints were stated, so `discovered-rules.md` holds
`None.` under both `## Mandated` and `## Forbidden`. The practice choices above
are not hard constraints and are not promoted into rules.

## Inference from the scope

- The `mvp` scope skips the entire operation phase, so the affirmed `## Deployment`
  practice is forward-looking guidance (how this team will deploy once the MVP
  graduates), not a practice exercised this run.
- The `mvp` scope's `skeleton: on` matches the human's "build a thin end-to-end
  slice first" choice.

## Remaining uncertainty

- **Concrete formatter/linter tooling is unresolved** until the stack is pinned:
  `Languages` is still `Unknown` in state, so the Code Style practice names the
  language-idiomatic defaults (Prettier/ESLint for TypeScript as the example)
  rather than a locked toolchain. Once the stack is chosen, the specific tools
  follow from the language.
