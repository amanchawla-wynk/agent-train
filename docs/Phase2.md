# Phase 2 — One-Click RCA Agent

> Read `AGENTS.md` first. Phase 1 must meet its acceptance criteria before starting this. Build only this phase.
> Stack reminder: OpenAI + Gemini models, Vercel AI SDK as the agent loop, MCP servers as tools, all running locally. No Anthropic.

## Goal

From the dashboard, a human picks a crash group and clicks **Run RCA**. An agent reads the crash, explores the code, finds the recent commits/PRs that likely caused it, and returns a structured root-cause report with evidence and confidence. The human reviews it. Nothing is written to Jira yet (that's Phase 3).

This is the phase that proves the "intelligence" claim on a real crash. It also creates the first graph edges (`crash -> PR`) as a byproduct.

## In scope
- An `agents` package built on the **Vercel AI SDK** (`ai` + `@ai-sdk/openai` + `@ai-sdk/google`).
- An **Explorer** step (cheap model) — locates the crashing symbol and recent changes via the **Serena MCP** (code) and the repo host, using multi-step tool calling. Runs with its own message array (isolated context) and returns a compact context package.
- A **synthesis** step (strong model) — produces the `RcaReport` via structured output (Zod schema).
- MCP tools: Serena (code), Firebase (crash detail) or the Phase 1 BigQuery export, GitHub (recent commits/PRs).
- `POST /api/rca` endpoint that runs the flow and returns an `RcaReport`.
- A **Run RCA** button on the dashboard with loading state and report rendering.
- Persist `crash -> PR` edges to Postgres (first graph edges).
- A hard per-run cost cap and per-run token/cost logging.

## Out of scope (do NOT build)
- Writing to Jira/Confluence (Phase 3).
- Code review / requirement validation (Phase 4).
- Anything beyond `crash -> PR` (+ optional `-> ticket`) edges.

## Product rules (from AGENTS.md — enforce them)
- The agent **must not** write to any external system of record. Output is a report only.
- Cheap model for the Explorer; strong model for synthesis. Providers may be mixed.
- Every finding records evidence (source + ref), confidence, skill version, model.
- Every run has a hard cost cap; log tokens and cost per run.

## LLM access: `packages/agents/llm.ts`

A single module resolves a tier name to an AI SDK model instance, so provider/model choices are config-only and never scattered through the code.

```ts
// Reads env, returns a Vercel AI SDK LanguageModel for the given tier.
// Two modes:
//  - DIRECT: use @ai-sdk/openai or @ai-sdk/google based on a "provider:model" string.
//  - GATEWAY: if LLM_GATEWAY_BASE_URL is set, use the OpenAI-compatible provider
//    pointed at the local LiteLLM proxy; the proxy routes to OpenAI/Gemini by model name.
export type Tier = 'explorer' | 'synthesis';
export function modelFor(tier: Tier): LanguageModel;
```

Start in DIRECT mode (simplest, fully local). Switch to GATEWAY mode by running the LiteLLM proxy locally and setting `LLM_GATEWAY_BASE_URL` — no feature-code changes. Use the proxy when you want central budgets and spend tracking.

## Agents package (`packages/agents`)

- `skills/rca-skill-v1.md` — the RCA procedure the synthesis step loads into its prompt: how to read a stack trace, how to weigh suspect PRs, how to assign confidence, the required report fields. **Versioned file** — bump the filename for changes; record the version on every report. (Write this one by hand; it encodes how we reason about iOS crashes.)
- `tools/mcp.ts` — connect to MCP servers (Serena, Firebase, GitHub) via the AI SDK's MCP client and expose their tools to the loop. Verify the current MCP client API against docs.
- `explorer.ts` — Explorer step (cheap model via `modelFor('explorer')`): given a crash group, run multi-step tool calling over the MCP tools to find the crashing symbol, owning files, and recent commits/PRs touching them. Keep it in its own message array; return a compact context package, not raw tool dumps.
- `rca.ts` — orchestration: run `explorer` -> run synthesis (`generateObject` with the `RcaReportSchema`, strong model via `modelFor('synthesis')`, loads `rca-skill-v1`) -> assemble `RcaReport`. Track `usage` from each call, sum cost, and abort if the run would exceed `RCA_MAX_BUDGET_USD`.
- `graph/edges.ts` — derive `GraphEdge[]` from the report (`crash -> introduced_by -> pr`) and persist.

## Data model & schemas (`packages/shared`)

Define these as Zod schemas and infer the TS types from them, so the same schema validates the LLM output and types the code.

```ts
import { z } from 'zod';

export const EvidenceSchema = z.object({
  source: z.enum(['serena', 'crashlytics', 'github', 'jira']),
  ref: z.string(),
  detail: z.string(),
});

export const SuspectPRSchema = z.object({
  repo: z.string(),
  number: z.number(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
});

export const RcaReportSchema = z.object({
  crashGroupId: z.string(),
  summary: z.string(),
  likelyCause: z.string(),
  suspectPrs: z.array(SuspectPRSchema),   // ranked, most likely first
  relatedTicket: z.string().optional(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceSchema),
});

export type RcaReport = z.infer<typeof RcaReportSchema> & {
  skillVersion: string;   // e.g. "rca-skill-v1"
  model: string;
  costUsd: number;
  createdAt: string;
};

export interface GraphEdge {
  from: string;        // e.g. "crash:CRASH-001"
  to: string;          // e.g. "pr:movies_ios#432"
  relation: 'introduced_by' | 'implements' | 'originates_from';
  confidence: number;  // 0..1
  source: string;      // e.g. "rca-skill-v1"
  observedAt: string;
}
```

The LLM produces only the `RcaReportSchema` fields (via `generateObject`); `skillVersion`, `model`, `costUsd`, and `createdAt` are attached in code.

## Server additions (`packages/server`)
- `POST /api/rca` body `{ crashGroupId }` -> runs `rca.ts`, persists edges, returns `RcaReport`.
- `db/` — Postgres connection + a single `edges` table (`from, to, relation, confidence, source, observed_at`). Migrations included.
- Log every run's model, tokens, cost, and budget outcome.

## Web additions (`packages/web`)
- **Run RCA** button on each crash row -> `POST /api/rca`, show loading, then render the report: likely cause, ranked suspect PRs (reason + confidence), related ticket if any, evidence list, overall confidence.
- **Create Jira** stays disabled with a "Phase 3" tooltip.

## Environment (extend `.env.example`)
```
# Providers (DIRECT mode)
OPENAI_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=

# Model tiering as "provider:model" (use current model names; verify against docs)
LLM_EXPLORER=google:gemini-flash-latest     # cheap tier (example)
LLM_SYNTHESIS=openai:gpt-strong-latest      # strong tier (example)

# Optional local gateway (GATEWAY mode). If set, llm.ts routes through it.
LLM_GATEWAY_BASE_URL=                        # e.g. http://localhost:4000
LLM_GATEWAY_API_KEY=                         # litellm virtual key

# Budget
RCA_MAX_BUDGET_USD=0.50

# Tools / data
GITHUB_TOKEN=                                # read-only, repo scope
DATABASE_URL=postgres://...
# Serena / Firebase MCP connection config per your setup
```

## Acceptance criteria
- [ ] `POST /api/rca { crashGroupId }` returns an object that passes `RcaReportSchema`.
- [ ] The Explorer uses Serena to locate the crashing symbol and the repo host to find recent PRs touching those files; runs on the cheap tier via `modelFor('explorer')`.
- [ ] Synthesis runs on the strong tier, loads `rca-skill-v1`, and uses `generateObject` with `RcaReportSchema`.
- [ ] Each run respects `RCA_MAX_BUDGET_USD`; model, tokens, and cost are logged.
- [ ] `crash -> PR` edges are persisted to Postgres with confidence, source, timestamp.
- [ ] The dashboard triggers RCA, shows loading, and renders the report. No external writes occur.
- [ ] Provider/model selection is config-only through `llm.ts`; no `@ai-sdk/*` imports in feature code.
- [ ] Everything runs locally with no hosting platform dependency. `tsc --noEmit` clean; tests pass for edge derivation and schema validation.

## Task list (do in order)
1. Add `agents` package + Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/google`); verify versions against docs.
2. `llm.ts` model registry (DIRECT mode first; GATEWAY mode behind `LLM_GATEWAY_BASE_URL`).
3. `shared`: Zod schemas (`RcaReportSchema`, `GraphEdge`) + inferred types + validation tests.
4. `tools/mcp.ts`: connect Serena, Firebase, GitHub MCP servers; smoke-test each.
5. `explorer.ts` (cheap tier) — multi-step tool calling, isolated message array, returns context package.
6. `skills/rca-skill-v1.md` + `rca.ts` synthesis (`generateObject`, strong tier) + budget tracking/abort.
7. Postgres `edges` table + migration + `graph/edges.ts` persistence.
8. `POST /api/rca` endpoint + cost/token logging.
9. Dashboard Run RCA button + report rendering.
10. (Optional) Stand up the local LiteLLM proxy, flip to GATEWAY mode, confirm budgets/spend tracking.
