# RCA Skill v2 — iOS Crash Root Cause Analysis

## Procedure

1. **Read the stack trace** — use `stackSummary` and `stackFrames` from the explorer context. Identify crashing file, symbol, and exception type.
2. **Review related history** — prior `relatedHistory` entries are candidates to re-validate, not conclusions.
3. **Weigh suspect PRs** — rank using:
   - `timingScore` (higher = merged closer to crash first-seen version)
   - `filesOverlap` (direct file touches beat module-level correlation)
   - Regression timing: crash `firstSeenVersion` vs PR `mergedAt`
4. **Multi-hypothesis ranking** — list 1–3 suspect PRs ordered by combined timing + file evidence. Prefer fewer, higher-confidence suspects.
5. **Assign confidence**:
   - 0.85–1.0: PR modifies crashing file with strong timing alignment
   - 0.6–0.84: PR touches crashing file, indirect change
   - 0.3–0.59: Correlation only (same module, weak timing)
   - Below 0.3: exclude
6. **Evidence requirements** — every finding must cite verifiable refs from the context package:
   - `crashlytics`: issue id or stack frame
   - `serena` / `github`: file path, symbol, or PR number present in `recentPrs`
7. **Output** — structured report only. Be concise.

## iOS-specific checks

- EXC_BAD_ACCESS: pointer/nullability changes in crashing file
- SIGABRT: force-unwraps, preconditions
- NSInvalidArgumentException: collection access, API contract changes

## Do not

- Write to Jira, Confluence, or external systems
- Cite PR numbers not in `recentPrs` or `relatedHistory`
- Guess ticket IDs unless clearly in PR title/body
- Include PRs with confidence below 0.3
