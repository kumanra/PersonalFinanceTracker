---
name: tdd-audit
description: Adversarially audits a completed red-green-refactor cycle - independently re-verifies test selection and the determinism check via tdd-cycle-auditor, and independently re-verifies the implementation and the tdd-refactor-scout's findings via tdd-implementation-auditor. Use after a red-green-refactor cycle (or a batch of them) to catch things the cycle's own self-report might have gotten wrong or missed, rather than trusting it at face value.
---

# TDD Audit

A second, skeptical pass over work the `red-green-refactor` skill already did. Where
that skill's agents (`tdd-green`, `tdd-refactor-scout`) report what they did, this
skill's agents (`tdd-cycle-auditor`, `tdd-implementation-auditor`) independently
re-verify it rather than trust the report. Run this after a cycle (or a batch of
cycles) you want checked, not as part of every cycle automatically - it's a deliberate
second opinion, not a rubber stamp built into the loop.

## Usage

`/tdd-audit [commit-range]` - defaults to auditing the most recent red-green-refactor
cycle's commit(s) if no range is given (find them via `git log` - look for the
`feat:`/`test:`/`refactor:` commits most recently produced by that skill).

## Why this exists

Self-review is weak review: the same reasoning that produced a conclusion is prone to
re-confirming it. This project has already hit a concrete case worth remembering - a
commit landed whose message described only part of its actual diff, and a pending,
legitimate change got swept in alongside unrelated files from another tool. Nothing
in the red-green-refactor loop's own steps would have caught that on its own; it took
someone independently reading `git show --stat` against what was claimed. That's the
shape of thing this skill exists to catch systematically instead of by accident.

## Protocol

### Step 1 - Gather the evidence to hand off

Identify the commit(s) under audit and the cycle's own reports (test chosen, the
before/after pass/fail evidence it claimed, the `tdd-refactor-scout` findings, what
was applied vs. skipped). Don't editorialize or summarize away detail - the auditors
need the actual claims to check them against, not your paraphrase.

### Step 2 - Run both auditors in parallel

They're independent of each other (one audits selection/determinism, the other audits
implementation/refactor quality) - launch both as fresh subagents in a single message,
not sequentially, and not as forks (they need a clean, bounded brief, not this
session's full context).

```
Agent(subagent_type="tdd-cycle-auditor", prompt="<test claimed as 'next failing',
  before/after evidence claimed, commit SHA(s) to audit>")

Agent(subagent_type="tdd-implementation-auditor", prompt="<implementation diff,
  tdd-refactor-scout's findings, relevant Gherkin scenario(s)>")
```

### Step 3 - Reconcile and report

Present both verdicts together, verbatim where they found something - don't soften a
CONTRADICTED verdict into a suggestion. If either auditor contradicts a claim from the
original cycle:

- A contradicted **determinism/selection** claim (tdd-cycle-auditor) means the cycle's
  "no other tests passed" guarantee can't be trusted as reported - treat this as
  blocking until re-verified live (re-run the full-suite snapshot yourself), not just
  noted for later.
- A contradicted **implementation/scout** claim (tdd-implementation-auditor) means a
  refactor-opportunity or correctness finding was wrong or missed - surface it to the
  user the same way `red-green-refactor`'s Step 5 does (present, don't auto-apply).

If both auditors confirm everything, say so plainly and stop - don't pad the report.

This skill never edits files itself, directly or via its agents - both auditors are
read-only. Any fix that comes out of an audit finding goes back through
`red-green-refactor` (a new or corrected cycle), not through this skill.
