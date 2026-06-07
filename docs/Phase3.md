# Phase 3 — PRD Gap Review

> Read `AGENTS.md` first. Phases 1–2 must meet acceptance criteria before starting this. Build only this phase.

## Goal

From the dashboard **PRD Review** tab, a human picks a Confluence PRD and clicks **Run gap review**. An agent reads the PRD body, identifies gaps (acceptance criteria, edge cases, analytics, rollout, ownership), and returns a structured `PrdGapReport` with evidence and severity. **No Confluence writes.**

## In scope

- Mock-first Confluence read via fixtures (`packages/server/fixtures/prds/`)
- Opt-in Atlassian MCP (`ATLASSIAN_MCP_ENABLED`) for live page fetch
- `runPrdGapReview` in `packages/agents` (strong/review tier via `llm.ts`)
- `prd-gap-skill-v1.md` — gap checklist and severity rules
- `GET /api/prds`, `POST /api/prd-review`, `GET /api/prd-review/:runId`
- Async job worker + `prd_review_runs` table
- `has_gap` graph edges (`prd → gap`)
- Dashboard PRD tab with report panel
- `pnpm eval:prd` golden fixture harness

## Out of scope (defer)

- Confluence publish (tech-doc draft) — Phase 4
- PR code review vs PRD — Phase 5
- RCA → Jira — Phase 6
- Confluence webhooks / CQL polling
- Serena / code exploration

## Product rules

- **No external writes** — report only
- Every gap cites `confluence` evidence with `sectionRef`
- Hard per-run budget (`PRD_MAX_BUDGET_USD`)
- Record skill version, model, cost on every report

## Acceptance criteria

- [ ] `GET /api/prds` lists configured PRDs from fixtures
- [ ] `POST /api/prd-review { prdId }` returns report with gaps for incomplete fixture
- [ ] `has_gap` edges persisted to Postgres
- [ ] Dashboard PRD tab: list, run, poll, render report
- [ ] Mock path works without Atlassian credentials
- [ ] Tests pass; `pnpm eval:prd` runs
