# Session Snapshots

This folder holds one snapshot per working session with Claude Code on this project.
Each snapshot is a dated, committed record of what happened in that session, so the
project's history is readable without digging through chat scrollback.

## Layout

```
docs/sessions/
  YYYY-MM-DD-short-slug/
    summary.md       # What was asked, what changed, decisions/assumptions made, commits produced
    transcript.md     # Condensed chronological record of the session (not a byte-exact raw log)
    repo-state.md      # git log / status / notable command output captured at snapshot time
```

- **Folder name**: the session's start date plus a short kebab-case slug describing the work (e.g. `2026-11-04-add-expense-playwright`).
- **summary.md**: the human-facing record — goal, what was done, assumptions flagged, resulting commit SHAs, open follow-ups.
- **transcript.md**: a condensed reconstruction of the back-and-forth (requests and outcomes), useful for recovering *why* a decision was made. Not a raw tool-call log.
- **repo-state.md**: objective, reproducible state at the time of the snapshot (`git log`, `git status`, relevant command output like test results).

## Convention for future sessions

At a natural stopping point in a session (or when asked), write a new dated folder here
following the layout above. See [CLAUDE.md](../../CLAUDE.md) for the house rule.
