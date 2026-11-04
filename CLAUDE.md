# Project Instructions

## Writing Gherkin scenarios

When generating a Gherkin feature file for a piece of functionality, don't stop at the
single happy path. Cover each of the following categories, and group scenarios under
comment headers (`# Happy paths`, `# Small features / UX`, `# Validation errors`,
`# Negative / edge cases`) so the spread is visible at a glance:

- **Happy paths** — the primary flow, plus realistic variations a user would actually
  hit: different valid input shapes (e.g. decimals, multi-word text), alternate ways to
  trigger the action (e.g. pressing Enter vs. clicking a button), and sequences of
  repeated actions (e.g. adding more than one item, duplicate entries, ordering).
- **Small features / UX** — incidental behavior implied by the feature: field clearing
  or trimming after submit, disabled/enabled control states, focus management, ordering
  guarantees. These are easy to skip but are usually asserted in tests.
- **Validation / error scenarios** — every required field missing, invalid individually
  and in combination, and confirmation that an error clears once corrected and
  resubmitted successfully.
- **Negative / edge cases** — inputs at or beyond the boundary (empty string,
  whitespace-only, zero, negative, oversized length, excess decimal precision,
  unexpected characters/symbols), and system robustness (an invalid submission must not
  mutate existing state; duplicate/rapid submissions must not double-apply; untrusted
  input must render as data, never execute).

Flag any assumption baked into a scenario (e.g. a max length or decimal precision limit)
that isn't backed by an existing wireframe, requirement, or prior decision, so it can be
confirmed before it becomes the basis for implementation or tests.

Keep the scope of the feature file to the functionality actually requested — don't pull
in adjacent fields or flows from a wireframe that weren't asked for; add those as their
own feature files when that work starts.

## Session snapshots

At a natural stopping point in a working session (or when asked), write a dated
snapshot to `docs/sessions/YYYY-MM-DD-short-slug/` containing `summary.md`,
`transcript.md`, and `repo-state.md`. See `docs/sessions/README.md` for the exact
layout and what belongs in each file. Commit these alongside the session's other
changes so project history stays readable without digging through chat scrollback.
