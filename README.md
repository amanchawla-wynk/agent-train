# AgentTrain

Engineering intelligence platform — Phase 1 ships a **crash digest**; Phase 2 adds **one-click RCA** from the dashboard.

See [AGENTS.md](AGENTS.md) for platform conventions, [docs/Phase1.md](docs/Phase1.md) and [docs/Phase2.md](docs/Phase2.md) for specs.

## Setup pnpm

If `pnpm` is not installed:

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

## Prerequisites

### Mock mode (default)

Works with zero GCP setup. Fixture data is loaded from `packages/server/fixtures/crashes/`.

### Real BigQuery (when ready)

1. Enable [Crashlytics → BigQuery export](https://firebase.google.com/docs/crashlytics/bigquery-export) for each Firebase project.
2. Create a **read-only** service account with access to the export dataset.
3. Set `GOOGLE_APPLICATION_CREDENTIALS`, `BIGQUERY_PROJECT_ID`, and per-app table names in `.env`.
4. Set `CRASHLYTICS_DATA_SOURCE=bigquery`.

**Note:** With batch-only BigQuery export, 24h velocity windows are coarse (daily batch granularity). This is acceptable for Phase 1.

## Local Postgres (Homebrew)

Phase 2 RCA persistence and the context graph need Postgres. Use a **local Homebrew** install (Docker is not used):

```bash
brew install postgresql@17
brew services start postgresql@17

# Add psql/createdb to PATH if needed (Apple Silicon example):
# echo 'export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"' >> ~/.zshrc

createdb agenttrain
```

In `.env`, set `DATABASE_URL` to your local user (no password is typical on macOS):

```
DATABASE_URL=postgresql://YOUR_MAC_USERNAME@localhost:5432/agenttrain
```

Then:

```bash
pnpm db:check      # verify connection
pnpm db:migrate    # create tables (edges, rca_runs)
```

## Quick start

```bash
pnpm install
cp .env.example .env
# configure DATABASE_URL (see Local Postgres above), then:
pnpm db:migrate
pnpm dev
```

- API: http://localhost:3001
- Dashboard: http://localhost:5173

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Run API + dashboard concurrently |
| `pnpm build` | Build all packages |
| `pnpm test` | Run Vitest in shared + server |
| `pnpm typecheck` | Typecheck all packages |
| `pnpm --filter @agent-train/server digest:run` | Manually post digest to Teams webhook |
| `pnpm db:check` | Verify `DATABASE_URL` connects to local Postgres |
| `pnpm db:migrate` | Apply database migrations |

## Environment

See [.env.example](.env.example). Key variables:

- `CRASHLYTICS_DATA_SOURCE` — `mock` (default) or `bigquery`
- `APPS` — comma-separated app ids
- `APP_<ID>_TABLE` — BigQuery table per app (e.g. `APP_IOS_MAIN_TABLE=com.example.app_IOS`)
- `DIGEST_WEBHOOK_URL` — Microsoft Teams incoming webhook (optional; logs warning if unset)

### Phase 2 (RCA)

- `OPENAI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` — LLM providers (DIRECT mode)
- `LLM_EXPLORER` / `LLM_SYNTHESIS` — model tiering as `provider:model`
- `GITHUB_TOKEN` — read-only token for suspect PR lookup
- `DATABASE_URL` — Postgres for graph edges and async runs
- `SERENA_MCP_COMMAND` — optional; without it, Explorer uses mock context

### Phase 3 (PRD gap review)

- `PRDS` — comma-separated PRD ids (fixtures in `packages/server/fixtures/prds/`)
- `PRD_MAX_BUDGET_USD` — per-run budget for gap review
- `LLM_REVIEW` — optional review-tier model (defaults to synthesis model)
- `ATLASSIAN_MCP_ENABLED` — opt-in live Confluence read (default mock)

## API

- `GET /api/health` — server status, data source, integration status
- `GET /api/apps` — configured app list
- `GET /api/crash-groups?app=<id>&days=<n>` — ranked crash groups by `priorityScore` desc
- `POST /api/rca` — run RCA for `{ crashGroupId, appId }`, returns `RcaReport`
- `GET /api/prds` — list configured PRDs
- `POST /api/prd-review` — run gap review for `{ prdId }`, returns `PrdGapReport` (or `{ runId }` async)
- `GET /api/prd-review/:runId` — poll PRD review status

## Project structure

```
packages/
  shared/   # Types, scoring, Zod schemas (pure, tested)
  agents/   # RCA agent: Explorer + synthesis, llm.ts, MCP tools
  server/   # Express API, BigQuery/mock providers, Teams digest, Postgres
  web/      # React dashboard with Run RCA
```
