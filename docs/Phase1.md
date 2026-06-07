# Phase 1 — Crash Digest

> Read `AGENTS.md` first. Build only this phase. Do not add agents, code reading, Jira/Confluence, or the graph yet.

## Goal

A service that pulls crash groups from Crashlytics (via BigQuery export), ranks them with a regression-weighted priority score, posts a daily ranked digest to a notification webhook, and shows the ranked queue in a React dashboard.

No AI, no agents. Pure data + scoring + UI. This proves we can connect to the data and ship something the team uses daily.

## In scope
- Read crash groups for one or more configured apps from the Crashlytics BigQuery export.
- Compute a priority score per crash group.
- Expose a ranked list over an HTTP API.
- Post a daily top-N digest to a Teams/Slack incoming webhook.
- A React dashboard rendering the ranked queue.

## Out of scope (do NOT build)
- Any AI/agent code, code exploration, RCA.
- Jira, Confluence, GitHub integration.
- The context graph / Postgres.
- Any write to an external system other than the notification webhook.

## Prerequisite setup (document in README; do not block on it)
- Each app's Firebase project must have the **Crashlytics → BigQuery export** enabled.
- A read-only service account with access to the export dataset; path in `GOOGLE_APPLICATION_CREDENTIALS`.

## Data model (`packages/shared`)

```ts
export interface CrashGroup {
  id: string;              // Crashlytics issue id
  app: string;             // configured app identifier
  title: string;           // human label, e.g. "EXC_BAD_ACCESS in PlaybackController"
  signature: string;       // grouping signature / top frame
  usersAffected: number;
  eventCount: number;
  velocityPct: number;     // % change in event rate over the last 24-48h
  firstSeenVersion: string;
  latestVersion: string;   // latest app version where it occurs
  isRegression: boolean;   // first appeared in/after the latest release
  priorityScore: number;   // 0-100, computed by scoreCrashGroup()
}
```

## Scoring (`packages/shared`, pure + unit-tested)

```ts
export function scoreCrashGroup(c: Omit<CrashGroup, 'priorityScore'>, ctx: ScoringContext): number;
```

Formula intent:

```
score = normalize(
  usersWeight   * log1p(usersAffected) +
  velocityWeight* clamp(velocityPct) +
  regressionWeight * (isRegression ? 1 : 0) +
  recencyWeight * versionRecency(latestVersion, ctx.currentVersion)
) -> 0..100
```

Rules:
- **Regression is the dominant signal** — a group new in/after the latest release outranks a higher-volume but stable group. Set `regressionWeight` accordingly and make it tunable via `ScoringContext`.
- Weights live in `ScoringContext` (defaults in code, overridable via config) so they can be tuned without code changes.
- Pure function, no I/O. Unit tests must cover: regression beats volume, ranking order is stable, edge cases (zero users, missing version).

## Server (`packages/server`, Express + TS)

Modules:
- `crashlytics/bigquery.ts` — `@google-cloud/bigquery` client; `fetchCrashGroups(app, sinceDays): Promise<RawCrashRow[]>`.
- `crashlytics/map.ts` — map raw BigQuery rows → `CrashGroup` (without score). Determine `isRegression` by comparing `firstSeenVersion` to the latest release version.
- `ranking.ts` — apply `scoreCrashGroup`, sort desc.
- `routes/crashGroups.ts` — `GET /api/crash-groups?app=<id>&days=<n>` → ranked `CrashGroup[]`.
- `digest/poster.ts` — format top-N as a message; POST to `DIGEST_WEBHOOK_URL`.
- `jobs/dailyDigest.ts` — cron/scheduled entry that builds and posts the digest.

## Web (`packages/web`, React + Vite + Tailwind)

A single dashboard page that calls `GET /api/crash-groups` and renders the ranked queue:
- Score badge (color by tier: ≥80 danger, 50–79 warning, <50 muted).
- Crash signature + file.
- App name + version.
- Users affected, velocity, and a `regression` tag when applicable.
- Sorted by score descending.

(The actions "Run RCA" / "Create Jira" are Phase 2/3 — render them disabled or omit them now.)

## Environment (`.env.example`)
```
GOOGLE_APPLICATION_CREDENTIALS=./secrets/sa.json
BIGQUERY_PROJECT_ID=
CRASHLYTICS_DATASET=
APPS=app_one,app_two            # comma-separated configured app ids
DIGEST_WEBHOOK_URL=
DIGEST_TOP_N=10
PORT=3001
```

## Acceptance criteria
- [ ] `pnpm install && pnpm -r build` succeeds; `tsc --noEmit` clean across packages.
- [ ] `scoreCrashGroup` is pure, in `shared`, with Vitest tests covering regression-beats-volume and stable ordering.
- [ ] `GET /api/crash-groups?app=<id>` returns crash groups ranked by `priorityScore` desc.
- [ ] The daily digest job posts a readable top-N ranked message to `DIGEST_WEBHOOK_URL`.
- [ ] The React dashboard renders the ranked queue with score, signature, app/version, users, velocity, regression tag.
- [ ] All credentials are read-only and sourced from env. No writes anywhere except the digest webhook.

## Task list (do in order, each with tests + a small commit)
1. Scaffold pnpm monorepo; create `shared`, `server`, `web` packages; wire `@eng-intel/shared`.
2. `shared`: `CrashGroup`, `ScoringContext`, `scoreCrashGroup` + tests.
3. `server`: BigQuery client + `fetchCrashGroups` (mock the client in tests).
4. `server`: `map.ts` (incl. `isRegression`) + `ranking.ts` + tests.
5. `server`: `GET /api/crash-groups` endpoint.
6. `server`: digest formatter + webhook poster + `dailyDigest` job.
7. `web`: dashboard page consuming the endpoint; tier-colored score badges.
8. README: setup, BigQuery export prerequisite, env, run commands.
