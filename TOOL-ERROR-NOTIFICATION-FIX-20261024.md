# Tool Error Notification Fix — 2026-10-24

## Symptom

A completed model answer could still display a global “请求失败 / Exit code: 1” dialog when one internal `bash`/PowerShell command returned a non-zero exit code. Commands such as `rg` legitimately return exit code 1 when no matches are found.

## Root cause

`App.tsx` collected every `tool.state.error` in the current turn and passed it to the global error-notification presenter. This conflated an internal failed tool step with a failed model request.

## Fix

- Added `selectTurnIssue(messages, conversationError)`.
- Global notifications now consider only assistant-message errors and stream/conversation errors.
- Tool exit codes remain visible in the execution activity with their command and original detail.
- Network, authentication, timeout, interruption, and response-format errors still produce global notifications.

## Regression protection

`test/issue-presentation.test.js` now verifies that:

- A tool error with `Exit code: 1` produces no global issue.
- An assistant message error still produces a notification issue.
- A conversation/stream error still produces a notification issue.

## Verification

- Focused tests: passed
- TypeScript: passed
- ESLint: passed
- Vite production build: passed
- Packaged 1.0.1 startup from the final ZIP: passed
- Fresh profile does not inherit local API/session data
