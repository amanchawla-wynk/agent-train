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

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm db:up          # start Postgres (Phase 2 graph edges)
pnpm db:migrate     # create edges table
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
| `pnpm db:up` | Start local Postgres via docker-compose |
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
- `DATABASE_URL` — Postgres for `crash → PR` graph edges
- `SERENA_MCP_COMMAND` — optional; without it, Explorer uses mock context

## API

- `GET /api/health` — server status, data source, integration status
- `GET /api/apps` — configured app list
- `GET /api/crash-groups?app=<id>&days=<n>` — ranked crash groups by `priorityScore` desc
- `POST /api/rca` — run RCA for `{ crashGroupId, appId }`, returns `RcaReport`

## Project structure

```
packages/
  shared/   # Types, scoring, Zod schemas (pure, tested)
  agents/   # RCA agent: Explorer + synthesis, llm.ts, MCP tools
  server/   # Express API, BigQuery/mock providers, Teams digest, Postgres
  web/      # React dashboard with Run RCA
```
