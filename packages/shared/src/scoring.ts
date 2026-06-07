import type { CrashGroup, CrashGroupInput, ScoringContext } from './types.js';
import { DEFAULT_SCORING_CONTEXT } from './types.js';
import { versionRecency } from './version.js';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function log1p(value: number): number {
  return Math.log1p(Math.max(0, value));
}

function clampVelocity(velocityPct: number): number {
  return clamp(velocityPct, -100, 500) / 100;
}

export function scoreCrashGroup(
  crash: CrashGroupInput,
  ctx: ScoringContext,
): number {
  const weights = { ...DEFAULT_SCORING_CONTEXT, ...ctx };

  const raw =
    weights.usersWeight * log1p(crash.usersAffected) +
    weights.velocityWeight * clampVelocity(crash.velocityPct) +
    weights.regressionWeight * (crash.isRegression ? 1 : 0) +
    weights.recencyWeight * versionRecency(crash.latestVersion, ctx.currentVersion);

  const maxRaw =
    weights.usersWeight * log1p(100_000) +
    weights.velocityWeight * 5 +
    weights.regressionWeight * 1 +
    weights.recencyWeight * 1;

  if (maxRaw <= 0) return 0;

  const normalized = (raw / maxRaw) * 100;
  return Math.round(clamp(normalized, 0, 100) * 100) / 100;
}

export function compareCrashGroups(a: CrashGroup, b: CrashGroup): number {
  if (b.priorityScore !== a.priorityScore) {
    return b.priorityScore - a.priorityScore;
  }
  if (b.usersAffected !== a.usersAffected) {
    return b.usersAffected - a.usersAffected;
  }
  return a.id.localeCompare(b.id);
}
