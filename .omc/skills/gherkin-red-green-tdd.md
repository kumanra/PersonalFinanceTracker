---
name: gherkin-red-green-tdd
description: Implement a Gherkin feature one scenario at a time, red-to-green, across the Playwright e2e suite and the Vitest/RTL component suite, with a strict full-suite verification gate at every step.
triggers:
  - red-green
  - next scenario
  - implement the next test
  - BDD scenario by scenario
  - gherkin tdd step
  - uncomment the next test
---

# Gherkin red-green TDD

## Goal

Turn a Gherkin `.feature` file into working code one scenario at a time, so every
commit represents exactly one scenario going from failing/skipped to passing —
never a batch of scenarios landing together, and never an accidental regression
slipping in unnoticed.

## Inputs

- A Gherkin feature file in `features/<name>.feature` (source of truth for scenario
  text and ordering).
- A matching Playwright spec in `e2e/<name>.spec.ts` — one `test(...)` per scenario,
  real E2E (`page.goto`), not Component Testing.
- A matching Vitest + React Testing Library spec in `src/<name>.test.tsx` — one
  `it(...)` per scenario, used as the fast local feedback loop.
- `npm run test` (Vitest) and `npm run test:e2e` (Playwright) as the two suites to
  run after every change.

## Steps

1. **Pick the scenario.** Default to the next scenario in the `.feature` file's
   order. It's fine to jump ahead of that order when there's a concrete reason —
   e.g. pinning a behavior (like decimal-amount handling) before a riskier change
   that could regress it — but say so explicitly when doing it.
2. **Sync the scenario across all three artifacts** before writing production code:
   - Confirm/add the scenario text in the `.feature` file.
   - Confirm/add the matching `test(...)` in `e2e/<name>.spec.ts`.
   - Un-skip (or add as active) the matching `it(...)` in `src/<name>.test.tsx`.
   Every *other* scenario's Vitest test stays `it.skip`/`test.skip` (or simply not
   yet ported) until its own turn. Do not get ahead of yourself.
3. **Write the minimum production code** needed to make that one newly-active test
   pass. Don't implement validation/behavior for scenarios that haven't had their
   turn yet, even if it's obvious what they'll need.
4. **Run the full test suite, not just the test in focus**: `npm run test` and
   `npm run test:e2e`. This is the core discipline of this skill — the gate is not
   optional:
   - The chosen test now passes.
   - Every other test's skip/fail status is unchanged — nothing else silently
     flipped to passing, nothing unrelated broke.
   - Lint and types are clean: `npx eslint <changed files>` and
     `npx tsc --noEmit -p tsconfig.json`.
5. **If a test itself turns out to be wrong, fix the test, don't paper over it.**
   Example hit in this repo: `getByRole('listitem', { name: /.../ })` can never
   match, because the `listitem` ARIA role doesn't compute its accessible name
   from content (unlike `button`/`link`). The fix was asserting on content via
   `getAllByRole('listitem')` + `toHaveTextContent(...)` instead. When this
   happens, call it out explicitly rather than quietly changing the assertion.
6. **Commit the whole step together** — feature file + e2e spec + Vitest test +
   any production code change, in one commit. The commit message should name the
   scenario implemented and call out any test-correctness fix made along the way.

## Success criteria

- Exactly one previously-red/skipped test is green after the step.
- Full-suite run shows no other test changed status.
- Lint and typecheck are clean.
- The commit for the step is self-contained (feature + specs + code together).

## Pitfalls

- Implementing ahead of the current scenario ("while I'm in here, I'll also handle
  the amount validation") breaks the one-scenario-per-step guarantee and makes it
  hard to tell which change made which test pass.
- Running only the test in focus (not the full suite) can hide a real regression,
  like a config change accidentally letting one test runner pick up the other
  runner's spec files.
- Accessible-name assumptions (`getByRole(role, { name })`) silently fail for ARIA
  roles that don't compute name-from-content — verify against the actual
  accessibility tree when a role-based query doesn't find an element you can see
  in the DOM dump.
