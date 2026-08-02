#!/bin/bash
# Gate a monthly security-review prompt behind a stored last-run timestamp.
STATE_FILE=".claude/.last-security-check"
NOW=$(date +%s)
THIRTY_DAYS=$((30 * 24 * 60 * 60))

LAST=0
[ -f "$STATE_FILE" ] && LAST=$(cat "$STATE_FILE")

if [ $((NOW - LAST)) -ge "$THIRTY_DAYS" ]; then
  echo "$NOW" > "$STATE_FILE"
  cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"Monthly security check is due for this project. Review the codebase for security gaps (exposed secrets/credentials, Firebase Realtime Database rules and auth boundaries, the take(1) write-isolation pattern described in CLAUDE.md, dependency vulnerabilities, input validation, XSS/injection risks) and propose concrete fixes for anything found."}}
JSON
fi
