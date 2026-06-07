# PRD Gap Review Skill v1

## Procedure

1. **Read the full PRD** — understand goals, user stories, and stated scope before flagging gaps.
2. **Check each category** — report gaps only when something is missing or materially weak:
   - **Acceptance criteria** — testable, complete given/user-when/then or equivalent
   - **Edge cases** — offline, errors, permissions, accessibility, retries
   - **Analytics** — events, funnels, success metrics tied to goals
   - **Rollout** — phased release, feature flags, kill switch, rollback
   - **Ownership** — PM, engineering, QA contacts
   - **Scope** — ambiguous boundaries, missing out-of-scope statements
3. **Assign severity**:
   - `critical` — blocks safe implementation or release (e.g. no rollout plan for risky change)
   - `warning` — likely causes rework or misalignment
   - `info` — nice-to-have clarity improvements
4. **Evidence** — every gap must cite `confluence` with a section heading or quote anchor in `sectionRef`.
5. **Rank gaps** — critical first, then warning, then info.
6. **Scoring** — `completenessScore` reflects how implementation-ready the PRD is (1.0 = thorough).

## Do not

- Write to Confluence or Jira
- Invent requirements not implied by the PRD
- Flag gaps for sections that are genuinely N/A for trivial changes
- Include gaps with confidence below 0.4
