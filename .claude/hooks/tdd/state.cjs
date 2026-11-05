const fs = require('fs')
const path = require('path')

// Normalize an absolute or relative tool_input.file_path to a project-root-relative,
// forward-slash path. Critical for correctness: a naive substring/regex match against
// the raw absolute path is a trap wherever the repo's own checkout path happens to
// contain a directory name that collides with a guarded folder (e.g. a repo checked
// out under ".../src/<project>" would make "contains \src\" match everything).
function toProjectRelative(filePath) {
  if (!filePath) return ''
  const rel = path.isAbsolute(filePath) ? path.relative(process.cwd(), filePath) : filePath
  return rel.split(path.sep).join('/')
}

const STATE_PATH = path.join(__dirname, 'state.json')

// Order matters - index comparisons below assume this sequence.
const PHASES = [
  'idle',
  'cycle-started', // next-failing-test picked, not yet verified by tdd-cycle-auditor
  'selection-verified', // tdd-cycle-auditor confirmed the pick; src edits now allowed
  'determinism-verified', // full-suite before/after diff confirmed clean; feature commit allowed
  'refactor-assessed', // scout + implementation-auditor findings gathered, user decided
  'refactoring', // approved refactor(s) being applied; src edits allowed
  'refactor-verified', // zero-net-change diff confirmed; refactor commit allowed
]

function phaseIndex(phase) {
  return PHASES.indexOf(phase)
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
  } catch {
    return { phase: 'idle' }
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
}

function phaseAtLeast(state, phase) {
  return phaseIndex(state.phase) >= phaseIndex(phase)
}

function readStdin() {
  return new Promise((resolve) => {
    let input = ''
    process.stdin.on('data', (chunk) => {
      input += chunk
    })
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(input))
      } catch {
        resolve({})
      }
    })
    if (process.stdin.isTTY) resolve({})
  })
}

function denyPreToolUse(reason) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    })
  )
  process.exit(0)
}

function allow() {
  process.exit(0)
}

module.exports = {
  STATE_PATH,
  PHASES,
  phaseIndex,
  readState,
  writeState,
  phaseAtLeast,
  readStdin,
  denyPreToolUse,
  allow,
  toProjectRelative,
}
