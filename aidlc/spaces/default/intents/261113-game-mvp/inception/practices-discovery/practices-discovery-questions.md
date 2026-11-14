# Practices Discovery — Questions

## Q1. [Delivery] How should the work flow into the codebase?

A. Everything lands on `main` directly — each piece of work is squashed into one commit on main
B. Feature branches — one branch per change, merged back via a review
C. Not sure
X. Other (please specify)

[Answer]: B

## Q2. [Delivery] Build a thin end-to-end slice first?

A walking skeleton is a minimal version that runs the whole way through, built first to prove the pieces connect before the real features go in.

A. Yes — build a thin end-to-end slice first, then flesh out the features
B. No — build feature by feature
C. Not sure
X. Other (please specify)

[Answer]: A

## Q3. [Quality] How should we test?

A. Test-after — build first, then write and run tests; the MVP keeps an 80% line-coverage floor
B. Test-first (TDD) — write tests before the code
C. Behavior-first (BDD) — Given/When/Then scenarios drive the code
D. Not sure
X. Other (please specify)

[Answer]: B

## Q4. [Delivery] How should releases work?

A. Deploy to a staging spot on merge; production only after a manual go-ahead
B. Deploy straight to production on merge
C. No deployment yet — solo MVP, just keep main green
X. Other (please specify)

[Answer]: A

## Q5. [Developer] Code style conventions?

A. Defer to the standard formatter/linter for the language (e.g. Prettier/ESLint for TypeScript); idiomatic naming
B. Specific conventions (name them)
C. Not sure
X. Other (please specify)

[Answer]: A

---

## Consolidated Summary Confirmation

- Way of working: feature branches — one branch per change, merged back via a review; work merges into `main` (Q1)
- Walking skeleton: yes — build a thin end-to-end slice first, then flesh out the features (Q2)
- Testing: test-first (TDD) — write tests before the code; the MVP keeps an 80% line-coverage floor (Q3)
- Deployment: staging on merge, production only after a manual go-ahead (Q4)
- Code style: defer to the standard formatter/linter for the language, idiomatic naming (Q5)

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
