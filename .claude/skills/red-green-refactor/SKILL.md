---
name: red-green-refactor
description: Automates one full TDD cycle (and can loop through all of them) against playwright/add-expense.spec.ts - finds the next failing test in source order, delegates a minimal implementation to the tdd-green agent, verifies determinism via a full-suite before/after diff, delegates a refactor-opportunity scan to tdd-refactor-scout, gets user sign-off on which to apply, applies approved ones (again via tdd-green), re-verifies, and commits. Use when the user wants to drive the remaining Add Expense scenarios to green without being asked after every single one, or asks to "automate the red-green-refactor loop" / "run the TDD loop".
---

# Red-Green-Refactor Loop

Automates the cycle this project has been doing by hand: pick the next failing
Playwright test, implement the minimum code to pass it, prove nothing else moved,
scout for cleanup opportunities, get the user's sign-off, apply what they pick, commit.

Scope: `playwright/add-expense.spec.ts` (the suite) against `src/App.tsx` and related
production files. Everything here assumes that test file and this repo's conventions
(`CLAUDE.md`, `.cursorrules`).

## Usage

- `/red-green-refactor` - run exactly one cycle (one test), then stop and report.
- `/red-green-refactor --continuous` - keep looping, cycle after cycle, until every
  test in the file is passing, a cycle aborts, or the user says stop. The only pause
  inside a continuous run is the user sign-off in Step 5 of each cycle - that always
  happens, loop or not.

If no argument is given, default to a single cycle (safer default; the user can ask
for `--continuous` explicitly when they want the full unattended run).

## Preconditions

1. `git status --short` - the working tree should be clean (aside from the
   unrelated `.omc/state/**` churn this repo always has). If there's unrelated
   uncommitted work, stop and ask before proceeding - don't commit someone else's
   in-progress changes as part of a TDD cycle.
2. Confirm `node_modules` is installed (`npx playwright --version` succeeds).

## Determinism rule (read this before Step 1)

Every cycle captures the **full suite's** pass/fail set before and after each
change (the implementation, and separately each applied refactor) - never just the
one targeted test. Use the JSON reporter, not the list reporter, so the diff is
machine-exact rather than eyeballed from terminal output:

```
npx playwright test --reporter=json > <scratch>/pw-results.json
```

Parse it like this (verified against this repo's Playwright version - `tests[0].status`
is Playwright's own expected/unexpected flag, but the real pass/fail signal is the
*last* entry in `results`):

```js
const fs = require('fs')
const data = JSON.parse(fs.readFileSync('<scratch>/pw-results.json', 'utf8'))
const specs = []
function walk(suite) {
  for (const s of suite.suites || []) walk(s)
  for (const spec of suite.specs || []) {
    const test = spec.tests[0]
    const status = test.results[test.results.length - 1].status
    specs.push({ title: spec.title, passed: status === 'passed' })
  }
}
for (const s of data.suites) walk(s)
specs.forEach((s) => console.log(s.passed ? 'PASS' : 'FAIL', s.title))
```

Run this via `node -e "..."` (or a scratch `.js` file in the scratchpad dir) to get a
clean `{title -> passed}` map. Diff two such maps (`before`, `after`) as:

- `newlyPassing` = passed in `after`, not in `before`
- `newlyFailing` = passed in `before`, not in `after` (**a regression - always fatal**)

## Hook enforcement (not optional prose - the harness blocks you)

This cycle is enforced by `.claude/settings.json` PreToolUse hooks (see
`.claude/hooks/tdd/`), not just these instructions. A phase state machine lives in
`.claude/hooks/tdd/state.json` (gitignored, runtime-only) and is advanced exclusively
via `node .claude/hooks/tdd/phase.cjs <subcommand> ...`. The hooks read that file and
will **deny** the Edit/Write/Bash tool calls below if you try to skip a step:

- Any edit to a test/spec/feature file is denied for the whole cycle, every phase.
- Edits to `src/**` (or `vite.config.ts`) are denied unless phase is
  `selection-verified` (implementing) or `refactoring` (applying an approved refactor).
- `git commit` is denied unless phase is `determinism-verified` or `refactor-verified`.

Phases, in order: `idle → cycle-started → selection-verified → determinism-verified →
refactor-assessed → refactoring → refactor-verified → idle`. Run
`node .claude/hooks/tdd/phase.cjs status` any time to check where you are, and
`node .claude/hooks/tdd/phase.cjs` with no args for the subcommand list. If a cycle
hard-stops, `node .claude/hooks/tdd/phase.cjs reset` returns to idle.

## The cycle

### Step 1 - Find the next failing test, then verify the pick

Run the determinism snapshot (above) to get `before`. Pick the **first failing test
in source order** (top-to-bottom in `add-expense.spec.ts`, i.e. the same order
`npx playwright test --list` prints) - not any other order. Source order is what
makes "the next failing test" a deterministic, repeatable choice given the same code,
rather than depending on run-to-run scheduling.

If there are no failing tests, stop here and report the suite is fully green.

Otherwise: `node .claude/hooks/tdd/phase.cjs start "<exact test title>"`. This locks
production-code edits until the pick is verified.

Then delegate to the `tdd-cycle-auditor` agent (fresh subagent) to independently
re-derive that this really is the first failing test in source order - don't just ask
it to agree with your pick, give it the `before` snapshot and let it reconstruct the
pre-cycle state itself. Write its verdict to a scratch file, then run
`node .claude/hooks/tdd/phase.cjs verify-selection <verdictFile>`. This requires the
word CONFIRMED to appear and refuses if CONTRADICTED appears anywhere - if the auditor
disagreed, resolve that before proceeding, don't force the phase forward.

### Step 2 - Make it pass with minimal implementation

Delegate to the `tdd-green` agent (fresh subagent, not a fork - it needs a clean,
narrowly-scoped brief, not this skill's full context). Give it:
- The exact test title and its `file:line`.
- The relevant Gherkin scenario text from `docs/features/add-expense.feature` (helps
  it understand intent, not just the assertions).
- The hard constraint: minimum code for *this* test only, no test file edits (the
  hook would deny it anyway, but tell the agent so it doesn't waste a turn finding out).

### Step 3 - Verify determinism ("make sure no other tests pass")

Re-run the snapshot to get `after`. Run
`node .claude/hooks/tdd/phase.cjs verify-determinism <before.json> <after.json>` - it
recomputes the diff itself from the two JSON files (don't hand-wave this; the CLI's
diff is what the commit gate trusts, not your own summary of it):

- If the target test is not in `newlyPassing`: the command fails loudly. Give the
  agent one more targeted attempt with the failure output; if it still doesn't work,
  stop and report to the user rather than looping indefinitely.
- If `newlyFailing` is non-empty (anything regressed): the command fails loudly.
  **Hard stop.** `git diff` the agent's changes, revert them (`git checkout --
  <files>`), and report exactly what broke. Do not continue the loop.
- If it succeeds with extra entries in `newlyPassing` beyond the target test: this is
  not automatically a problem - a correct minimal implementation can legitimately
  satisfy more than one assertion (this happened in this project's own history: one
  minimal form implementation incidentally passed 5 other scenarios, 2 of which turned
  out to be genuinely satisfied and 3 of which turned out to be false positives from
  loose assertions). **Do not silently accept this either way.** The CLI records them
  under `extraPasses` in state.json - carry that list into Step 4 as priority-scrutiny
  targets.

Phase is now `determinism-verified` - a `git commit` for the implementation is
unlocked (but production-code edits are locked again until Step 6's `refactoring`
phase, so don't try to sneak in more changes here).

### Step 4 - Scout for refactor opportunities, then audit the scout

Delegate to the `tdd-refactor-scout` agent (fresh subagent). Give it:
- `git diff` of the implementation change (uncommitted at this point).
- The list of touched files.
- The extra `newlyPassing` tests from Step 3 (the `extraPasses` field in
  `state.json`), explicitly flagged: "these passed incidentally - check whether
  they're passing for the right reason."

It returns a numbered list of findings (or an explicit "nothing found").

Then delegate to `tdd-implementation-auditor` (fresh subagent) with the scout's
findings plus the same diff - it independently reproduces at least the scout's
headline finding and spot-checks something the scout cleared, rather than just
re-reading the scout's reasoning and agreeing. Reconcile: a CONFIRMED scout finding it
also confirms goes to the user alongside anything new the auditor found; a
CONTRADICTED one needs that disagreement resolved (or at minimum surfaced) before
Step 5, not silently dropped.

### Step 5 - Share findings, get sign-off

Always pause here, loop or not - this is the one step a human decides. If both agents
found nothing, say so and move on without asking:
`node .claude/hooks/tdd/phase.cjs assess-refactor none` then skip to Step 7 via
`node .claude/hooks/tdd/phase.cjs skip-refactor` (this returns phase straight to
`idle` - there's no second commit to make).

Otherwise present the combined findings (scout + auditor) and use `AskUserQuestion`
(multiSelect) so the user picks which to apply, none, or all. Don't editorialize the
list away - show what was actually found, including things you might not personally
prioritize. Record the outcome:
`node .claude/hooks/tdd/phase.cjs assess-refactor approved` if anything was approved,
or `... assess-refactor none` + `... skip-refactor` if nothing was.

### Step 6 - Apply approved refactors

`node .claude/hooks/tdd/phase.cjs begin-refactor` (only works if Step 5 recorded
`approved`) - this unlocks production-code edits again for this phase only.

For each approved finding, delegate to `tdd-green` again with that one specific,
already-approved change (reuse the same agent type - applying an approved refactor is
still "write minimal code for a precise target," just with the target being a
refactor description instead of a failing test).

After the batch is applied, re-run the full-suite snapshot and run
`node .claude/hooks/tdd/phase.cjs verify-refactor-determinism <before.json> <after.json>`
(the "before" here is the post-Step-3 state, i.e. the snapshot you already have from
`after` in Step 3 - rename/reuse it, don't re-derive it from memory). Required:
**zero net change** in the passing/failing set - a refactor must be
behavior-preserving, full stop. The command fails loudly on any change in either
direction; if it fails, `git diff`/revert the refactor and report it rather than
retrying blindly.

### Step 7 - Commit

- One commit for the implementation (Step 2/3's result, phase `determinism-verified`
  unlocked it), using this project's commit style (see recent `git log`, and the
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer used throughout
  this repo's history).
- A **separate** commit for the refactor pass, if anything was applied in Step 6
  (phase `refactor-verified` unlocked it) - don't bundle feature and refactor commits,
  matching this repo's existing pattern.
- Leave `.omc/state/**` unstaged, as with every other commit in this project - it's
  OMC's own session telemetry, not part of the work.
- `node .claude/hooks/tdd/phase.cjs reset` once done (if `skip-refactor` in Step 5
  didn't already return you to `idle`), so the next cycle can start cleanly.

### Step 8 - Report

State plainly: which test went green, the full suite's new pass/fail count, what was
found in the refactor scan (and what the auditor confirmed/contradicted), what got
applied, and the commit SHA(s).

### Step 9 - Loop or stop

- Single-cycle mode (default): stop here regardless of remaining failures.
- `--continuous` mode: if failing tests remain, go back to Step 1 (phase should be
  `idle` by now - if it isn't, something wasn't closed out correctly; fix that before
  starting the next cycle). If the suite is fully green, stop and report. If a cycle
  hard-stopped (Step 3 or Step 6 regression), stop the loop entirely and report -
  don't attempt the next test on top of an unresolved failure.

When the loop ends (fully green, or the user stops it), follow this project's
session-snapshot convention from `CLAUDE.md` (`docs/sessions/YYYY-MM-DD-short-slug/`)
to record what the loop did across its cycles.
