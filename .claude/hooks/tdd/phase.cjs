#!/usr/bin/env node
// CLI used by the orchestrating red-green-refactor run (not a hook itself) to record
// each required verification as a state transition. The PreToolUse hooks in this same
// directory read the resulting state.json to gate edits and commits - so these
// transitions are the only way to unlock the next step, not just documentation of intent.
//
// Usage:
//   node phase.cjs status
//   node phase.cjs start "<test title>"
//   node phase.cjs verify-selection <verdictFile>
//   node phase.cjs verify-determinism <beforeJson> <afterJson>
//   node phase.cjs assess-refactor approved|none
//   node phase.cjs begin-refactor
//   node phase.cjs skip-refactor
//   node phase.cjs verify-refactor-determinism <beforeJson> <afterJson>
//   node phase.cjs reset
const fs = require('fs')
const { readState, writeState } = require('./state.cjs')

function fail(message) {
  console.error(`FAIL: ${message}`)
  process.exit(1)
}

function ok(message, state) {
  console.log(`OK: ${message}`)
  console.log(JSON.stringify(state, null, 2))
}

function requirePhase(state, expected) {
  if (state.phase !== expected) {
    fail(`expected phase "${expected}", got "${state.phase}". Run "status" to inspect.`)
  }
}

function parsePlaywrightJson(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const map = {}
  function walk(suite) {
    for (const s of suite.suites || []) walk(s)
    for (const spec of suite.specs || []) {
      const test = spec.tests[0]
      const status = test.results[test.results.length - 1].status
      map[spec.title] = status === 'passed'
    }
  }
  for (const s of data.suites) walk(s)
  return map
}

function diffPassing(before, after) {
  const titles = new Set([...Object.keys(before), ...Object.keys(after)])
  const newlyPassing = []
  const newlyFailing = []
  for (const t of titles) {
    const was = !!before[t]
    const is = !!after[t]
    if (is && !was) newlyPassing.push(t)
    if (!is && was) newlyFailing.push(t)
  }
  return { newlyPassing, newlyFailing }
}

const [, , cmd, ...args] = process.argv
const state = readState()

switch (cmd) {
  case 'status': {
    console.log(JSON.stringify(state, null, 2))
    break
  }

  case 'start': {
    const [testName] = args
    if (!testName) fail('usage: start "<test title>"')
    requirePhase(state, 'idle')
    const next = { phase: 'cycle-started', targetTest: testName, cycleId: Date.now() }
    writeState(next)
    ok(`cycle started for "${testName}"`, next)
    break
  }

  case 'verify-selection': {
    const [verdictFile] = args
    if (!verdictFile) fail('usage: verify-selection <verdictFile>')
    requirePhase(state, 'cycle-started')
    const verdict = fs.readFileSync(verdictFile, 'utf8')
    if (/CONTRADICTED/i.test(verdict)) {
      fail(
        'tdd-cycle-auditor verdict contains CONTRADICTED - selection not confirmed. ' +
          'Resolve the discrepancy before implementing.'
      )
    }
    if (!/CONFIRMED/i.test(verdict)) {
      fail(
        'tdd-cycle-auditor verdict does not contain CONFIRMED anywhere - cannot treat ' +
          'selection as verified. Re-run the audit or check the verdict file.'
      )
    }
    const next = { ...state, phase: 'selection-verified', selectionVerifiedAt: new Date().toISOString() }
    writeState(next)
    ok('selection verified - production-code edits unlocked', next)
    break
  }

  case 'verify-determinism': {
    const [beforeJson, afterJson] = args
    if (!beforeJson || !afterJson) fail('usage: verify-determinism <before.json> <after.json>')
    requirePhase(state, 'selection-verified')
    const before = parsePlaywrightJson(beforeJson)
    const after = parsePlaywrightJson(afterJson)
    const { newlyPassing, newlyFailing } = diffPassing(before, after)
    if (newlyFailing.length > 0) {
      fail(`regression detected, newlyFailing: ${JSON.stringify(newlyFailing)}. Revert and retry.`)
    }
    if (!newlyPassing.includes(state.targetTest)) {
      fail(`target test "${state.targetTest}" is not in newlyPassing: ${JSON.stringify(newlyPassing)}`)
    }
    const extraPasses = newlyPassing.filter((t) => t !== state.targetTest)
    const next = {
      ...state,
      phase: 'determinism-verified',
      determinismVerifiedAt: new Date().toISOString(),
      newlyPassing,
      extraPasses,
    }
    writeState(next)
    ok(
      `determinism verified - target test passed, zero regressions` +
        (extraPasses.length ? `, ${extraPasses.length} extra incidental pass(es) recorded for scout review` : ''),
      next
    )
    break
  }

  case 'assess-refactor': {
    const [choice] = args
    if (choice !== 'approved' && choice !== 'none') fail('usage: assess-refactor approved|none')
    requirePhase(state, 'determinism-verified')
    const next = { ...state, phase: 'refactor-assessed', refactorChoice: choice }
    writeState(next)
    ok(`refactor assessment recorded: ${choice}`, next)
    break
  }

  case 'begin-refactor': {
    requirePhase(state, 'refactor-assessed')
    if (state.refactorChoice !== 'approved') {
      fail(`refactorChoice is "${state.refactorChoice}", expected "approved". Use skip-refactor instead.`)
    }
    const next = { ...state, phase: 'refactoring' }
    writeState(next)
    ok('refactor phase started - production-code edits unlocked for the approved change(s)', next)
    break
  }

  case 'skip-refactor': {
    requirePhase(state, 'refactor-assessed')
    if (state.refactorChoice !== 'none') {
      fail(`refactorChoice is "${state.refactorChoice}", expected "none". Use begin-refactor instead.`)
    }
    writeState({ phase: 'idle' })
    ok('cycle complete, no refactor applied - phase reset to idle', { phase: 'idle' })
    break
  }

  case 'verify-refactor-determinism': {
    const [beforeJson, afterJson] = args
    if (!beforeJson || !afterJson) fail('usage: verify-refactor-determinism <before.json> <after.json>')
    requirePhase(state, 'refactoring')
    const before = parsePlaywrightJson(beforeJson)
    const after = parsePlaywrightJson(afterJson)
    const { newlyPassing, newlyFailing } = diffPassing(before, after)
    if (newlyPassing.length > 0 || newlyFailing.length > 0) {
      fail(
        `refactor changed the pass/fail set - not behavior-preserving. ` +
          `newlyPassing: ${JSON.stringify(newlyPassing)}, newlyFailing: ${JSON.stringify(newlyFailing)}. Revert the refactor.`
      )
    }
    const next = { ...state, phase: 'refactor-verified', refactorVerifiedAt: new Date().toISOString() }
    writeState(next)
    ok('refactor determinism verified - zero net change, commit unlocked', next)
    break
  }

  case 'reset': {
    const terminal = state.phase === 'determinism-verified' || state.phase === 'refactor-verified'
    if (!terminal) {
      console.error(`WARN: resetting from non-terminal phase "${state.phase}" (likely an aborted/hard-stopped cycle).`)
    }
    writeState({ phase: 'idle' })
    ok('phase reset to idle', { phase: 'idle' })
    break
  }

  default: {
    console.error(
      'usage: phase.cjs <status|start|verify-selection|verify-determinism|assess-refactor|begin-refactor|skip-refactor|verify-refactor-determinism|reset> [args]'
    )
    process.exit(1)
  }
}
