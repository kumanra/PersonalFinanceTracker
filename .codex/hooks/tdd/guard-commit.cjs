#!/usr/bin/env node
// PreToolUse / Bash (no "if" scoping - see note below). Steps 3 and 6's "verify before
// commit" gate: a commit is only allowed once the cycle has reached a verified phase.
// Because guard-src-edit.cjs blocks src edits outside 'selection-verified'/'refactoring',
// reaching a verified phase here means no unverified edit could have slipped in since.
//
// This self-filters on tool_input.command instead of relying on settings.json's "if"
// field: in practice "if": "Bash(git commit*)" fired on unrelated non-commit Bash calls
// too (verified empirically - it blocked a plain `node script.cjs` invocation), which
// would have blocked ordinary work during a cycle, not just commits. Reading the actual
// command text ourselves is the same self-filtering pattern already used successfully
// in deny-test-edits.cjs and guard-src-edit.cjs.
const { readState, readStdin, denyPreToolUse, allow } = require('./state.cjs')

const COMMIT_READY_PHASES = new Set(['determinism-verified', 'refactor-verified'])
const GIT_COMMIT_PATTERN = /\bgit\s+commit\b/

readStdin().then((payload) => {
  const command = (payload.tool_input && payload.tool_input.command) || ''
  if (!GIT_COMMIT_PATTERN.test(command)) return allow()

  const state = readState()
  if (state.phase === 'idle') return allow() // no cycle tracked - don't block unrelated commits
  if (COMMIT_READY_PHASES.has(state.phase)) return allow()

  denyPreToolUse(
    `red-green-refactor: commit blocked in phase "${state.phase}" (target test: ` +
      `${state.targetTest || 'unknown'}). A commit requires phase "determinism-verified" ` +
      `(after the full-suite before/after diff) or "refactor-verified" (after the zero-net-change ` +
      `re-check). Run: node .claude/hooks/tdd/phase.cjs verify-determinism <before.json> <after.json> <targetTest> ` +
      `(or verify-refactor-determinism) before committing.`
  )
})
