# Team Practices

> Affirmed at the practices-discovery interview. These are now this team's
> standing practices for the project; Code Generation and later stages resolve
> them directly.

## Way of Working

- **Integration branch**: main

We use feature branches: one branch per change, merged back to `main` through a
review. Each piece of work starts from `main`, lands on its own branch, and
returns to `main` only after a reviewer signs off. This keeps `main` the
always-mergeable integration line while every change is isolated until it has
been reviewed.

## Walking Skeleton

We build a thin end-to-end slice first, then flesh out the features. The walking
skeleton is a minimal version that runs the whole way through, proving the
pieces connect end to end before the real features go in. The active `mvp` scope
declares `skeleton: on`, so the first Unit is the smallest working integrated
slice: it runs through all applicable per-unit stages and is verified with the
project's recorded Construction Verification Command, then held for the human's
skeleton checkpoint approval.

## Testing Posture

- **Methodology**: tdd
- **Methodology evidence**: the human affirmed test-first development. We write
  the test before the code, watch it fail, then implement the minimum code that
  makes it pass (red-green-refactor). Writing the test first pins each behavior
  to a verifiable, runnable check before implementation begins, so no behavior
  ships without a test that demands it.
- **Ordering**: write each test before the code it verifies, then implement until the test passes.
- **Coverage floor (mvp scope)**: 80% line coverage, with tests run in CI before
  merge; the `mvp` scope adds this floor on top of the selected test strategy.

## Deployment

We deploy to a staging spot on merge, and production only after a manual
go-ahead. Every merge lands on staging automatically so the change is exercised
in a real environment; promotion to production is a separate, human-approved
step rather than something the pipeline does on its own.

## Code Style

We defer to the standard formatter and linter for the language rather than
inventing project-wide rules: Prettier and ESLint for TypeScript (or the
language-default equivalents), and language-idiomatic naming (camelCase for
JS/TS, snake_case for Python, and so on) with no project-wide rename rules. When
the framework suggests a code style, the agent reads the project's linter config
first and only suggests what the linter doesn't already cover.
