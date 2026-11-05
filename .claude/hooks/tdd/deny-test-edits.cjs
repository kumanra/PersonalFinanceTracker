#!/usr/bin/env node
// PreToolUse / Edit|Write: while a red-green-refactor cycle is active (phase != idle),
// block any edit to test/spec/feature files. Step 2's "WITHOUT modifying the test" rule,
// enforced regardless of what the implementing agent claims it will or won't touch.
const { readState, readStdin, denyPreToolUse, allow, toProjectRelative } = require('./state.cjs')

function isTestPath(relPath) {
  return (
    relPath.startsWith('playwright/') ||
    relPath.startsWith('cypress/') ||
    relPath.endsWith('.feature') ||
    /\.(spec|test)\.[tj]sx?$/.test(relPath) ||
    /\.cy\.[tj]sx?$/.test(relPath)
  )
}

readStdin().then((payload) => {
  const state = readState()
  if (state.phase === 'idle') return allow()

  const filePath = toProjectRelative((payload.tool_input && payload.tool_input.file_path) || '')
  if (isTestPath(filePath)) {
    denyPreToolUse(
      `red-green-refactor cycle "${state.targetTest || 'unknown'}" is active (phase: ${state.phase}). ` +
        `Editing test/spec/feature files is blocked during a cycle: ${filePath}. ` +
        `If the test genuinely needs to change, stop the cycle deliberately (not via this edit) and handle it outside the automated loop.`
    )
  }
  return allow()
})
