# Phases 4–6 — Outline

> Deliberately light. Detailed specs written when prior phases ship.

## Phase 4 — Tech-doc draft + Confluence publish (human-approved)
- Turn PRD gap findings into a technical design draft
- Human edits and approves on dashboard
- First Confluence **write** via Atlassian MCP (opt-in, user permissions)
- Persist `prd → documents → tech_doc` edges

## Phase 5 — PR code review vs PRD
- On PR open/manual trigger: Explorer (Serena) + Reviewer
- Read linked Confluence PRD; compare implementation to requirement
- Emit review comments — never merge decisions
- Persist `PRD → ticket → PR → code` edges

## Phase 6 — Platform + deferred crash path
- RCA → Jira draft (human-approved) if still needed
- Cross-lifecycle queries over accumulated graph
- Teams notifications via CODEOWNERS ownership map
- Offline eval harness expansion
