# Project Instructions

## Gherkin feature files

- Gherkin `.feature` files go in a root-level `features/` directory (e.g. `features/add-expense.feature`), not under `docs/` or `cypress/e2e/`.

## End-to-end tests

- Each Gherkin feature in `features/` gets a matching Playwright spec in `e2e/` (e.g. `features/add-expense.feature` -> `e2e/add-expense.spec.ts`). Each scenario becomes one `test(...)`, named after the scenario.
- Use real Playwright E2E (`@playwright/test`, navigating via `page.goto`), not Playwright Component Testing (`@playwright/experimental-ct-react`). Component Testing is experimental and mounts components in isolation, which doesn't match the user-journey language in these feature files ("I am on the home page", "I submit the expense"). These specs exist to prove the integrated, routed app works end-to-end.
- For fast feedback on an isolated component while implementing, write a Vitest + React Testing Library test alongside the component instead (already set up in this repo, runs in jsdom with no browser) — don't reach for Playwright CT to fill that gap.
- When a feature isn't implemented yet, the matching Playwright spec should fail for the right reason (missing element/behavior), not time out — before writing/running it, keep `playwright.config.ts`'s `timeout` low (currently `3_000`ms) so a red suite gives fast feedback instead of burning the 30s default per test.
- Run the suite with `npm run test:e2e`.

## Implementing scenarios incrementally

- Implement one Gherkin scenario at a time. Its matching test is the only one that should go from red to green at that step; leave every other scenario's test `it.skip`/`test.skip` (or failing, if not yet ported) until its own step.
- After writing or changing code for a step, run the *full* test suite (`npm run test` and `npm run test:e2e`), not just the one test in focus. Confirm: the chosen test now passes, every skipped test is still skipped (not accidentally un-skipped or passing), and no previously-passing test broke. A skipped test silently starting to pass, or an unrelated suite failing, means the test runner config or the implementation touched more than this step intended.
