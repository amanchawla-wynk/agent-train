# AGENTS.md — Engineering Intelligence Platform

> This file is the always-loaded context for any AI coding agent working in this repo.
> If you are using a tool that reads a different filename (e.g. `CLAUDE.md`), copy or symlink this to it.
> Read this fully before writing code. Then read only the spec for the phase you are building (`docs/phase-N-*.md`). Do not implement future phases.

---

## What we are building

A platform that connects engineering systems (crash reporting, code, tickets, requirements) and uses AI agents to reason across them. We build it **value-first, one phase at a time** — each phase ships standalone value and unlocks the next. The full "platform" is the last thing we arrive at, never the first thing we build.

Current target: **frontend / mobile apps only.** Crash data comes from Firebase Crashlytics (one Firebase project per app).

## Everything runs locally

There is no required cloud or hosting platform. The API, web app, agent code, LLM gateway, and database all run on a local machine (or local Docker) during development, and deploy to our own infrastructure later. In particular: the Vercel AI SDK is just an npm library — it does **not** require Vercel hosting, an account, or any deployment target. It runs inside our own Node server.

## Phase order (build strictly in sequence)

| Phase | Ships | Status |
|---|---|---|
| 1 | Crash digest — ranked crash triage + dashboard | done |
| 2 | One-click RCA — agent diagnoses a crash, produces a report | done |
| 3 | PRD gap review — Confluence PRD gaps on dashboard (mock-first) | **current** |
| 4 | Tech-doc draft + human-approved Confluence publish | later |
| 5 | PR code review vs linked PRD | later |
| 6 | RCA → Jira + cross-lifecycle graph queries | later |

Specs live in `docs/`. Do not start a phase until the previous one meets its acceptance criteria.

## Tech stack (do not substitute without asking)

- **Runtime:** Node 20+, TypeScript (ESM, `"type": "module"`), strict mode on.
- **Monorepo:** pnpm workspaces.
- **API:** Express (Node + TS).
- **Web:** React + Vite + TypeScript + Tailwind CSS.
- **LLM providers:** **OpenAI and Google Gemini only** (company-approved). Do **not** use Anthropic / Claude models or SDKs anywhere.
- **Agent loop (Phase 2+):** **Vercel AI SDK** — npm `ai` plus `@ai-sdk/openai` and `@ai-sdk/google`. Open-source library, runs inside our own server, no hosting dependency. Provides the multi-step tool-calling loop, MCP client, structured output, and provider switching by model string. **Verify exact package names, versions, and current API surface against the official docs before installing** (the tool-loop and MCP APIs evolve between major versions).
- **LLM gateway (Phase 2+, self-hosted/local):** **LiteLLM Proxy** — an OpenAI-compatible gateway for central API keys, per-key budgets, spend tracking, and fallback. Runs locally (Docker or CLI). Optional to start: the AI SDK can call OpenAI/Gemini directly; introduce the proxy when central budgets and cost tracking are needed (see Phase 2 spec). If the company already mandates a gateway, point the AI SDK's OpenAI-compatible provider at it instead.
- **Schemas:** Zod — for LLM structured output and runtime validation.
- **Crash data:** Firebase Crashlytics -> BigQuery export, queried via `@google-cloud/bigquery` (Phase 1).
- **Persistence (Phase 2+):** Postgres (the context graph starts as a single typed-edges table — **not** a graph database).
- **Tests:** Vitest.
- **Config:** environment variables via `dotenv`. See `.env.example`.

## Repository structure

```
AgentTrain/
  pnpm-workspace.yaml
  package.json
  .env.example
  AGENTS.md
  docs/
    Phase1.md
    Phase2.md
    Phase3.md
    Phase3-5.md
  packages/
    shared/      # pure, tested TS types + scoring logic (no I/O)
    server/      # Express API + jobs
    web/         # React dashboard
    agents/      # (Phase 2+) RCA flow, llm.ts model registry, versioned skills
```

Shared logic (types, scoring, Zod schemas) lives in `packages/shared` so the server, the web app, and the agents all import the same definitions. Keep `shared` pure and fully unit-tested.

## Non-negotiable product rules (these are architecture, not preferences)

1. **Human in control.** Agents NEVER write to an external system of record (Jira, Confluence) on their own. They produce reports and drafts; a human triggers and approves every write. In Phases 1-2 there are **no external writes at all** beyond posting a digest to a notification webhook.
2. **Read-only credentials by default.** Crashlytics/BigQuery and code access are read-only. Least privilege.
3. **Crash groups, never raw events.** All crash logic operates on grouped issues, not individual crash events.
4. **Model tiering (Phase 2+).** Use a cheap model for exploration/triage and a strong model only for synthesis and judgment. Providers can be mixed freely (e.g. Gemini for exploration, OpenAI for synthesis) because the loop is provider-agnostic. Resolve models through a single `llm.ts`; never scatter provider SDK calls across the codebase.
5. **Budgets & cost.** Every agent run has a hard cost cap. Enforce it by reading token `usage` from each response and computing cost, and/or via LiteLLM proxy per-key budgets. Log model, tokens, and cost for every run.
6. **Provenance.** Every AI finding records its evidence (with source refs), confidence, the skill/prompt version that produced it, and the model used.
7. **No secrets in code or git.** Credentials come from env only.

## Conventions for you, the coding agent

- Work in **small, reviewable increments**. Complete one task from the phase spec's task list, with tests, before moving on.
- Import shared types and schemas from `@agent-train/shared`; do not redefine them locally.
- Resolve LLM models only through `packages/agents/llm.ts`. Do not import `@ai-sdk/openai` or `@ai-sdk/google` directly in feature code.
- Write Vitest unit tests for all pure logic (scoring, mappers, edge builders, schema validation).
- Do not add heavyweight dependencies without flagging it first.
- If an external SDK or API surface is unclear or may have changed (Vercel AI SDK, `@ai-sdk/*` providers, Gemini/OpenAI model names, MCP client APIs, Atlassian MCP endpoints, Crashlytics data access), **stop and verify against current official docs** rather than guessing. This space moves quarterly.
- Keep functions small and typed. No `any` unless justified with a comment.
- A task is **done** when: it meets the spec's acceptance criteria, tests pass, types check (`tsc --noEmit`), and it doesn't violate the product rules above.

## Glossary

- **Agent loop** — the code (Vercel AI SDK) that calls a model, executes the tools it requests, feeds results back, and repeats until done.
- **Sub-agent** — a bounded task run as its own function with its **own message array** (= isolated context) that returns a compact summary. In this stack it is a pattern we implement, not a built-in primitive.
- **Skill** — a versioned bundle of instructions/checklists loaded into a prompt (files under `packages/agents/skills`).
- **Context graph** — typed, confidence-weighted links between crashes, PRs, tickets, and requirements. Starts as one Postgres table.
- **Finding** — a single AI observation with severity, confidence, evidence, and provenance.
- **Gateway** — the LiteLLM proxy: one local OpenAI-compatible endpoint in front of OpenAI + Gemini for keys, budgets, and spend.
