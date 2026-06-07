# RCA Skill v1 — iOS Crash Root Cause Analysis

## Procedure

1. **Read the stack trace** — identify the crashing file, symbol, and exception type from the explorer context package and crash metadata.
2. **Weigh suspect PRs** — prefer PRs that:
   - Merged shortly before the crash first appeared in the latest release
   - Touch the crashing file or its direct callers
   - Are small, focused changes (nullability, threading, lifecycle)
3. **Assign confidence** — use this scale:
   - 0.85–1.0: PR directly modifies crashing line with matching regression timing
   - 0.6–0.84: PR touches crashing file but change is indirect
   - 0.3–0.59: Correlation only (same module, weak timing)
   - Below 0.3: Do not include as suspect PR
4. **Evidence requirements** — every finding must cite:
   - `crashlytics`: issue id, stack frame, or version info
   - `serena` or `github`: file path, symbol, or PR number
5. **Output** — produce only the structured report fields. Be concise. Rank suspect PRs most-likely first.

## iOS-specific checks

- EXC_BAD_ACCESS: check recent pointer/nullability changes
- SIGABRT: check force-unwraps and precondition failures
- NSInvalidArgumentException: check collection access and API contract changes

## Do not

- Write to Jira, Confluence, or any external system
- Guess ticket IDs unless clearly referenced in PR title/body
- Include PRs with confidence below 0.3
