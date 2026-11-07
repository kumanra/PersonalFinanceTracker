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

- Use the `gherkin-red-green-tdd` skill (`.omc/skills/gherkin-red-green-tdd.md`) to implement scenarios from a `features/*.feature` file: one scenario at a time, red to green, with a full-suite verification gate at every step.
- Delegate each scenario step to the `gherkin-scenario-implementer` agent (`.claude/agents/gherkin-scenario-implementer.md`) rather than running the workflow in the main conversation — it loads the skill and does one scenario per invocation, keeping the implementation's tool-call noise out of the main context.
