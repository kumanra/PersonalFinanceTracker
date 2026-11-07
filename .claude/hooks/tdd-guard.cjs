#!/usr/bin/env node
/**
 * Enforces the gherkin-red-green-tdd skill's loop (see .omc/skills/gherkin-red-green-tdd.md):
 *   1. "test chosen"   -> exactly one vitest test unskipped, and it fails.
 *   2. "implementing"  -> test/spec/feature files are locked; only src/** source may change.
 *   3+4. "green gate"  -> the chosen test passes, previously-passing tests still pass,
 *                         and nothing else flips to passing early (scope creep).
 *
 * Invoked as: node tdd-guard.cjs pre-edit   (PreToolUse,  Edit|Write|MultiEdit)
 *             node tdd-guard.cjs post-edit  (PostToolUse, Edit|Write|MultiEdit)
 * Hook JSON (cwd, tool_name, tool_input, ...) arrives on stdin.
 */
'use strict'

const fs = require('fs')
const path = require('path')
const net = require('net')
const http = require('http')
const { spawn, spawnSync } = require('child_process')

// Use the 'localhost' hostname (not a hardcoded IP) so readiness checks resolve
// the same address family npm/vite/Playwright pick by default (can be IPv6 ::1).
const DEV_SERVER_HOST = 'localhost'
const DEV_SERVER_PORT = 5173
const DEV_SERVER_TIMEOUT_MS = 30_000

function projectRoot(input) {
  return process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()
}

function statePath(root) {
  return path.join(root, '.claude', 'hooks', 'tdd-state.json')
}

function loadState(root) {
  try {
    return JSON.parse(fs.readFileSync(statePath(root), 'utf-8'))
  } catch {
    return { bootstrapped: false, phase: 'idle', chosenTest: null, baseline: {}, touchedFiles: [] }
  }
}

function saveState(root, state) {
  fs.mkdirSync(path.dirname(statePath(root)), { recursive: true })
  fs.writeFileSync(statePath(root), JSON.stringify(state, null, 2))
}

function toRel(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/')
}

function classify(rel) {
  if (/^src\/.*\.test\.tsx?$/.test(rel)) return 'vitest-test'
  if (/^e2e\/.*\.spec\.ts$/.test(rel)) return 'e2e-spec'
  if (/^features\/.*\.feature$/.test(rel)) return 'feature'
  if (/^src\//.test(rel)) return 'source'
  return 'other'
}

// ---- test runners -----------------------------------------------------

function isPortOpen(host, port, timeout) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(timeout)
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('timeout', () => { socket.destroy(); resolve(false) })
    socket.once('error', () => { resolve(false) })
    socket.connect(port, host)
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function httpGet(url, timeout) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout }, (res) => {
      res.resume()
      res.on('end', () => resolve(res.statusCode))
    })
    req.on('timeout', () => { req.destroy(); resolve(null) })
    req.on('error', () => resolve(null))
  })
}

// Vite's dev middleware transforms modules on first request. A TCP-level "is the
// port open" check can pass well before that transform is warm, which is what let
// the *first* e2e test spuriously time out against a technically-reachable server.
// Fetching the entry points here (outside any per-test timeout) absorbs that cost.
async function warmUp(root) {
  const base = `http://${DEV_SERVER_HOST}:${DEV_SERVER_PORT}`
  await httpGet(`${base}/`, 10_000)
  await httpGet(`${base}/src/main.tsx`, 10_000)
}

async function ensureDevServer(root) {
  if (await isPortOpen(DEV_SERVER_HOST, DEV_SERVER_PORT, 500)) return

  const logPath = path.join(root, '.claude', 'hooks', 'tdd-devserver.log')
  fs.mkdirSync(path.dirname(logPath), { recursive: true })
  const logFd = fs.openSync(logPath, 'a')
  const child = spawn('npm run dev', [], {
    cwd: root,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    shell: true,
  })
  child.unref()

  const deadline = Date.now() + DEV_SERVER_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await isPortOpen(DEV_SERVER_HOST, DEV_SERVER_PORT, 500)) {
      await warmUp(root)
      return
    }
    await sleep(500)
  }
  throw new Error(`dev server did not come up on ${DEV_SERVER_HOST}:${DEV_SERVER_PORT} within ${DEV_SERVER_TIMEOUT_MS}ms`)
}

function collectVitest(json) {
  const map = {}
  for (const fileResult of json.testResults || []) {
    const file = fileResult.name.replace(/\\/g, '/')
    for (const a of fileResult.assertionResults || []) {
      const id = `vitest::${file}::${a.fullName}`
      map[id] = a.status === 'passed' ? 'passed' : a.status === 'failed' ? 'failed' : 'skipped'
    }
  }
  return map
}

function collectPlaywright(json) {
  const map = {}
  function walk(suite) {
    const file = suite.file
    for (const spec of suite.specs || []) {
      const id = `pw::${file}::${spec.title}`
      const firstResult = spec.tests && spec.tests[0] && spec.tests[0].results && spec.tests[0].results[0]
      map[id] = firstResult && firstResult.status === 'skipped' ? 'skipped' : spec.ok ? 'passed' : 'failed'
    }
    for (const sub of suite.suites || []) walk(sub)
  }
  for (const suite of json.suites || []) walk(suite)
  return map
}

function runVitest(root) {
  const res = spawnSync('npx vitest run --reporter=json', [], {
    cwd: root,
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
    shell: true,
  })
  try {
    return collectVitest(JSON.parse(res.stdout))
  } catch (e) {
    throw new Error(`could not parse vitest output: ${e.message} (spawn error: ${res.error}, stderr: ${(res.stderr || '').slice(0, 300)})`)
  }
}

async function runPlaywright(root) {
  await ensureDevServer(root)
  const res = spawnSync('npx playwright test --reporter=json', [], {
    cwd: root,
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
    shell: true,
  })
  try {
    return collectPlaywright(JSON.parse(res.stdout))
  } catch (e) {
    throw new Error(`could not parse playwright output: ${e.message} (spawn error: ${res.error}, stderr: ${(res.stderr || '').slice(0, 300)})`)
  }
}

async function runFullSuite(root) {
  const vitestMap = runVitest(root)
  const pwMap = await runPlaywright(root)
  return { vitestMap, full: { ...vitestMap, ...pwMap } }
}

// ---- hook output helpers ----------------------------------------------

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
  }))
  process.exit(0)
}

function allow() {
  process.exit(0)
}

function block(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }))
  process.exit(0)
}

function info(message) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: message },
  }))
  process.exit(0)
}

function warnAndAllow(message) {
  console.error(`[tdd-guard] ${message}`)
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: `[tdd-guard] ${message}` },
  }))
  process.exit(0)
}

// ---- checkpoint logic ---------------------------------------------------

// A scenario has both a vitest test and a Playwright spec with the same title
// text (gherkin-red-green-tdd step 2). The vitest unskip is what triggers this
// checkpoint, but the paired e2e spec is expected to flip to green alongside it —
// that is not scope creep, so track both ids under one scenario.
//
// Vitest's `$param` title interpolation (used by `it.each`) wraps string values
// in extra quotes (`"'0'"`) where a hand-written Playwright title just inserts
// the raw value (`"0"`) — strip all quote characters before comparing so that
// still matches.
function normalizeTitle(title) {
  return title.replace(/['"]/g, '')
}

function findPairedPlaywrightId(chosenFullName, full) {
  const normalizedFullName = normalizeTitle(chosenFullName)
  for (const id of Object.keys(full)) {
    if (!id.startsWith('pw::')) continue
    const title = id.split('::').slice(2).join('::')
    if (normalizedFullName.endsWith(normalizeTitle(title))) return id
  }
  return null
}

// A Gherkin "Scenario Outline" (features/*.feature) compiles down to several
// runtime tests from one `it.each(...)` call, all unskipped by a single edit.
// Group newly-active ids by stripping the trailing quoted example value so
// those still count as "one scenario chosen", not a multi-unskip violation.
function baseTitle(fullName) {
  return fullName.replace(/\s*"[^"]*"\s*$/, '').trim()
}

function groupsShareOneBase(ids) {
  const bases = new Set(ids.map((id) => baseTitle(id.split('::').slice(2).join('::'))))
  return bases.size === 1
}

async function checkpointTestChosen(root, state) {
  const { vitestMap, full } = await runFullSuite(root)
  const baseline = state.baseline || {}

  if (!state.bootstrapped) {
    saveState(root, { bootstrapped: true, phase: 'idle', chosenTest: null, baseline: full, touchedFiles: [] })
    return info(`TDD gate initialized: captured baseline of ${Object.keys(full).length} tests. Future edits are now gated.`)
  }

  const newlyActive = []
  const unexpected = []
  for (const [id, status] of Object.entries(vitestMap)) {
    const before = baseline[id]
    if (before === undefined) { newlyActive.push(id); continue }
    if (before === 'skipped' && status !== 'skipped') newlyActive.push(id)
    else if (before !== 'skipped' && status === 'skipped') unexpected.push(`${id} was active, is now skipped`)
    else if (before === 'passed' && status === 'failed') unexpected.push(`${id} regressed from passing to failing`)
  }

  if (newlyActive.length === 0) return allow()

  if (newlyActive.length > 1 && !groupsShareOneBase(newlyActive)) {
    return block(`More than one vitest test was unskipped at once: ${newlyActive.join(', ')}. Unskip exactly one scenario's test at a time (gherkin-red-green-tdd step 2).`)
  }
  if (unexpected.length > 0) {
    return block(`Unexpected status change(s) while choosing a scenario: ${unexpected.join('; ')}.`)
  }

  const chosenIds = newlyActive
  const notFailed = chosenIds.filter((id) => vitestMap[id] !== 'failed')
  if (notFailed.length > 0) {
    return block(`Chosen test(s) not failing: ${notFailed.map((id) => `${id}=${vitestMap[id]}`).join(', ')}. The red-green loop requires the newly unskipped test to fail (red) before any implementation starts.`)
  }

  const pairedIds = [...chosenIds]
  for (const id of chosenIds) {
    const fullName = id.split('::').slice(2).join('::')
    const pairedPwId = findPairedPlaywrightId(fullName, full)
    if (pairedPwId && !pairedIds.includes(pairedPwId)) pairedIds.push(pairedPwId)
  }

  const regressions = []
  for (const [id, status] of Object.entries(full)) {
    if (pairedIds.includes(id)) continue
    if (baseline[id] === 'passed' && status !== 'passed') regressions.push(`${id}: passed -> ${status}`)
  }
  if (regressions.length > 0) {
    return block(`Choosing this scenario caused other regression(s): ${regressions.join('; ')}.`)
  }

  const label = chosenIds.length > 1 ? `${chosenIds.length} examples of "${baseTitle(chosenIds[0].split('::').slice(2).join('::'))}"` : chosenIds[0]
  const pwFile = pairedIds.find((id) => id.startsWith('pw::'))
  saveState(root, {
    bootstrapped: true,
    phase: 'implementing',
    chosenTest: {
      id: label,
      pairedIds,
      testFile: toRel(root, chosenIds[0].split('::')[1]),
      specFile: pwFile ? `e2e/${pwFile.split('::')[1]}` : null,
    },
    baseline: full,
    touchedFiles: [],
  })
  return info(`RED confirmed for "${label}". Implementation phase started: only src/** source files (not *.test.tsx) may change until the green gate passes. Test/spec/feature files are now locked.`)
}

// gherkin-red-green-tdd step 5: sometimes the newly-chosen test's own assertions
// are wrong (e.g. an ARIA role that doesn't compute its name from content) and
// the correct fix is to the test, not production code. This re-verifies that
// such a fix didn't touch anything outside the chosen scenario's own test(s).
async function checkpointTestFixed(root, state) {
  const { full } = await runFullSuite(root)
  const baseline = state.baseline || {}
  const pairedIds = state.chosenTest.pairedIds || []

  const unexpected = []
  for (const [id, status] of Object.entries(full)) {
    if (pairedIds.includes(id)) continue
    const before = baseline[id]
    if (before === undefined) { unexpected.push(`${id}: new test appeared`); continue }
    if (before === 'skipped' && status !== 'skipped') unexpected.push(`${id}: newly unskipped`)
    else if (before !== 'skipped' && status === 'skipped') unexpected.push(`${id}: now skipped`)
    else if (before === 'passed' && status !== 'passed') unexpected.push(`${id}: passed -> ${status}`)
  }
  if (unexpected.length > 0) {
    return block(`Correcting the test file caused unexpected change(s) outside the chosen scenario: ${unexpected.join('; ')}. Only touch the chosen scenario's own test/assertions.`)
  }

  const allGreen = pairedIds.length > 0 && pairedIds.every((id) => full[id] === 'passed')
  if (allGreen) {
    saveState(root, { bootstrapped: true, phase: 'idle', chosenTest: null, baseline: full, touchedFiles: [] })
    return info(`GREEN confirmed for "${state.chosenTest.id}" after correcting the test itself (no production code was needed). Test/spec/feature files unlocked — commit this step, then choose the next scenario.`)
  }

  saveState(root, { ...state, baseline: full })
  return info(`Test correction applied for "${state.chosenTest.id}"; still mid-implementation. No unexpected changes to other tests.`)
}

async function checkpointGreenGate(root, state, touchedRel) {
  const touchedFiles = Array.from(new Set([...(state.touchedFiles || []), touchedRel]))

  const { full } = await runFullSuite(root)
  const baseline = state.baseline || {}
  const chosenId = state.chosenTest.id
  const pairedIds = state.chosenTest.pairedIds || [chosenId]

  const regressions = []
  const scopeCreep = []
  for (const [id, status] of Object.entries(full)) {
    if (pairedIds.includes(id)) continue
    const before = baseline[id]
    if (before === 'passed' && status !== 'passed') regressions.push(`${id}: passed -> ${status}`)
    if (before !== undefined && before !== 'passed' && status === 'passed') scopeCreep.push(`${id}: ${before} -> passed`)
  }

  if (regressions.length > 0) {
    saveState(root, { ...state, touchedFiles })
    return block(`Implementation broke previously-passing test(s): ${regressions.join('; ')}. Fix the regression before continuing.`)
  }
  if (scopeCreep.length > 0) {
    saveState(root, { ...state, touchedFiles })
    return block(`Implementation made test(s) pass before their turn: ${scopeCreep.join('; ')}. Keep changes scoped to "${chosenId}" only.`)
  }

  const notYetGreen = pairedIds.filter((id) => full[id] !== 'passed')
  if (notYetGreen.length > 0) {
    saveState(root, { ...state, touchedFiles })
    return info(`Scenario "${chosenId}" still has non-passing test(s): ${notYetGreen.map((id) => `${id}=${full[id]}`).join(', ')}. No regressions or scope creep yet — keep implementing.`)
  }

  saveState(root, { bootstrapped: true, phase: 'idle', chosenTest: null, baseline: full, touchedFiles: [] })
  return info(`GREEN confirmed for "${chosenId}" (and its e2e counterpart). Files touched during implementation: ${touchedFiles.join(', ') || '(none recorded)'}. All previously-green tests still pass, nothing else flipped unexpectedly. Test/spec/feature files unlocked — commit this step, then choose the next scenario.`)
}

// ---- dispatch -----------------------------------------------------------

async function handlePreEdit(root, input) {
  if (!['Edit', 'Write', 'MultiEdit'].includes(input.tool_name)) return allow()
  const filePath = input.tool_input && input.tool_input.file_path
  if (!filePath) return allow()
  const rel = toRel(root, filePath)
  const kind = classify(rel)
  const state = loadState(root)

  if (state.phase === 'implementing') {
    const isChosenTestFile = kind === 'vitest-test' && rel === state.chosenTest.testFile
    const isChosenSpecFile = kind === 'e2e-spec' && rel === state.chosenTest.specFile
    if ((kind === 'vitest-test' || kind === 'e2e-spec' || kind === 'feature') && !isChosenTestFile && !isChosenSpecFile) {
      return deny(`Red-green gate: scenario "${state.chosenTest.id}" is mid-implementation. Test/spec/feature files are locked until the green gate passes — edit only src/** source files (not *.test.tsx), or the chosen scenario's own test file if its assertions are wrong (gherkin-red-green-tdd step 5).`)
    }
  }
  return allow()
}

async function handlePostEdit(root, input) {
  if (!['Edit', 'Write', 'MultiEdit'].includes(input.tool_name)) return allow()
  const filePath = input.tool_input && input.tool_input.file_path
  if (!filePath) return allow()
  const rel = toRel(root, filePath)
  const kind = classify(rel)
  const state = loadState(root)

  if (kind === 'vitest-test') {
    if (state.phase === 'implementing') {
      if (rel === state.chosenTest.testFile) return checkpointTestFixed(root, state)
      return block(`Test files are locked while implementing scenario "${state.chosenTest.id}". This edit should have been denied by the pre-edit gate — revert it and finish the green gate first.`)
    }
    return checkpointTestChosen(root, state)
  }

  if (kind === 'e2e-spec') {
    if (state.phase === 'implementing') {
      if (rel === state.chosenTest.specFile) return checkpointTestFixed(root, state)
      return block(`E2e spec files are locked while implementing scenario "${state.chosenTest.id}".`)
    }
    return allow()
  }

  if (kind === 'feature') {
    if (state.phase === 'implementing') {
      return block(`Feature files are locked while implementing scenario "${state.chosenTest.id}".`)
    }
    return allow()
  }

  if (kind === 'source') {
    if (state.phase !== 'implementing') return allow()
    return checkpointGreenGate(root, state, rel)
  }

  return allow()
}

async function main() {
  const mode = process.argv[2]
  let input
  try {
    input = JSON.parse(fs.readFileSync(0, 'utf-8'))
  } catch {
    return allow()
  }
  const root = projectRoot(input)

  try {
    if (mode === 'pre-edit') await handlePreEdit(root, input)
    else if (mode === 'post-edit') await handlePostEdit(root, input)
    else allow()
  } catch (err) {
    if (mode === 'pre-edit') {
      console.error(`[tdd-guard] internal error, allowing: ${err.message}`)
      return allow()
    }
    return warnAndAllow(`internal error, could not verify the TDD gate automatically (${err.message}). Please run the full suite manually and confirm the red/green state yourself.`)
  }
}

main()
