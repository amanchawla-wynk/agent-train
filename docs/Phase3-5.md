# Phases 3–5 — Outline

> Deliberately light. Do not build these yet. The detailed specs will be written once Phases 1–2 ship and the design has met reality. Capturing direction only.

## Phase 3 — RCA → Jira draft (human-approved)
- Turn an `RcaReport` into a **draft** Jira ticket that a human approves on the dashboard with one click.
- First external **write** — gated behind explicit human approval. Use the Atlassian (Rovo) MCP for the write; it runs under the user's permissions.
- Persist `pr → implements → ticket` edges. Traceability queries ("which crashes came from this release?") become possible.
- Key constraint: still no autonomous writes. The agent drafts; the human commits.

## Phase 4 — Spec-aware code review
- On a PR, run **one** narrow check: does the implementation match its linked requirement?
- Read the linked Confluence PRD (Atlassian MCP) and the requirement model; compare against the diff (Explorer + Serena).
- Emit findings as review comments — never merge decisions.
- Connects `PRD → ticket → PR → code` for new work. Start with requirement validation only; architecture/security/testing checks come later.
- Ingestion scope: newest/updated Confluence pages only (CQL on last-modified or a webhook). Historical backfill is deferred.

## Phase 5 — Platform (emergent)
- By now the graph spans `requirement → code → release → crash`. The cross-lifecycle capabilities are mostly queries over what already exists:
  - PRD gap detection on new requirements.
  - Tech-doc drafting with human-approved publish back to Confluence.
  - "What does this release touch / risk?" lifecycle queries.
- Notifications: route completions to the owning team via Teams, using a `CODEOWNERS`-derived ownership map.
- Evaluation: stand up an offline golden dataset (historical PRs + crashes with known answers) to regression-test skill/prompt versions before shipping. Track precision and acceptance **separately**.
- This phase is named, not pitched. It is the sum of Phases 1–4 plus the accumulated graph.
