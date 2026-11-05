#!/usr/bin/env node
// PreToolUse / Edit|Write: gates edits to production source during an active cycle.
// Step 1's "verify the test selection before implementing" rule - src edits are only
// allowed once the cycle has reached 'selection-verified' (implementation) or
// 'refactoring' (an approved refactor being applied). Edits are denied while a
// verification/determinism step is pending, so nothing can sneak in before or after
// a check that would invalidate it.
const { readState, readStdin, denyPreToolUse, allow, toProjectRelative } = require('./state.cjs')

const ALLOWED_PHASES = new Set(['idle', 'selection-verified', 'refactoring'])

function isGuardedSrcPath(relPath) {
  return relPath.startsWith('src/') || relPath === 'vite.config.ts'
}

readStdin().then((payload) => {
  const filePath = toProjectRelative((payload.tool_input && payload.tool_input.file_path) || '')
  if (!isGuardedSrcPath(filePath)) return allow()

  const state = readState()
  if (ALLOWED_PHASES.has(state.phase)) return allow()

  denyPreToolUse(
    `red-green-refactor: production-code edits are blocked in phase "${state.phase}" ` +
      `(target test: ${state.targetTest || 'unknown'}). Edits are only allowed in phase ` +
      `"selection-verified" (after tdd-cycle-auditor confirms the test pick) or "refactoring" ` +
      `(after an approved refactor and before its determinism re-check). Run the required ` +
      `verification step first: node .claude/hooks/tdd/phase.cjs for usage.`
  )
})
