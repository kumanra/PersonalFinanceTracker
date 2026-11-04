# Session: Add Expense — Gherkin spec + Playwright suite

**Date:** 2026-11-04
**Branch:** kumanra/ai-playground

## Goal

Start the first functional slice of the Personal Finance Tracker: adding an expense by
name and amount. Follow `docs/lesson-one-instructions.md`'s workflow (Gherkin spec →
failing e2e tests → review → implement incrementally).

## What was done

1. **Gherkin spec** — `docs/features/add-expense.feature`, scoped to name + amount only
   (not category/type, which the wireframe shows but weren't asked for). Extended on
   request to cover four categories: happy paths, small features/UX, validation errors,
   negative/edge cases (29 scenarios total).
2. **CLAUDE.md** — added a house rule requiring future Gherkin generation to cover all
   four of those categories, and to flag assumptions not backed by a wireframe/requirement.
3. **Playwright e2e suite** — since the repo only had Cypress configured and the lesson
   instructions call for Cypress, the user was asked and explicitly chose to add
   Playwright instead.
   - `playwright.config.ts` — Chromium project, auto-starts `npm run dev`, baseURL
     `http://localhost:5173`.
   - `playwright/support/expense-tracker-page.ts` — page object with locators/helpers.
   - `playwright/add-expense.spec.ts` — 29 tests, one per Gherkin scenario.
   - `playwright/tsconfig.json` — standalone type-checking, mirroring the existing
     `cypress/tsconfig.json` pattern (not wired into the root `tsc -b` build).
   - `package.json`: `test:e2e` script, `@playwright/test` devDependency.
   - `.gitignore`: `test-results/`, `playwright-report/`, `playwright/.cache/`.
4. **Verified red state** — lint clean, type-check clean, all 29 tests fail against the
   current app (no Add Expense UI exists yet; `App.tsx` only renders "Home"). Confirmed
   both inside and outside the sandbox — same result, ~3m55s wall time (each failing
   test burns the full 30s Playwright timeout waiting for a selector that doesn't exist;
   once implemented this should drop to a few seconds).
5. **Committed** — `20d2a55` "test: add Playwright e2e suite for Add Expense feature".

## Assumptions baked into the tests (flag before implementing against them)

- Name input placeholder `"Enter name..."`, amount input `"Enter amount..."` (from the wireframe).
- Amount field must be a **text** input, not `type="number"` — a native number input
  strips invalid characters before JS sees them, which would make several validation
  scenarios (`"abc"`, `"$5"`, `"5a"`) untestable.
- List/total render as an HTML `<table>`: one `<tr>` per expense, a `"Total"` row.
- Validation errors use `role="alert"` and mention "name"/"amount" in their text.
- Max name length (256) and max amount precision (2 decimal places) are assumptions,
  not requirements seen anywhere — confirm before relying on them.

## Commits produced

- `20d2a55` — test: add Playwright e2e suite for Add Expense feature

(CLAUDE.md and the feature file were committed earlier in `f5e6f4b`, before this
summary was written.)

## Open follow-ups

- Implement the Add Expense feature itself, scenario by scenario (per
  `docs/lesson-one-instructions.md` step 4), to turn the 29 tests green.
- Decide whether to keep Playwright long-term or consolidate on one e2e framework —
  the repo now has both Cypress (routing smoke test) and Playwright (this feature) configured.
