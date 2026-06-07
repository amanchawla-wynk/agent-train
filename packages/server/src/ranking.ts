import {
  compareCrashGroups,
  scoreCrashGroup,
  type CrashGroup,
  type CrashGroupInput,
  type ScoringContext,
  DEFAULT_SCORING_CONTEXT,
} from '@agent-train/shared';
import { deriveCurrentVersion } from './crashlytics/map.js';
import type { RawCrashRow } from './crashlytics/types.js';
import { mapRawRowsToCrashGroups } from './crashlytics/map.js';

export function rankCrashGroups(
  groups: CrashGroupInput[],
  currentVersion: string,
): CrashGroup[] {
  const ctx: ScoringContext = {
    ...DEFAULT_SCORING_CONTEXT,
    currentVersion,
  };

  const scored = groups.map((g) => ({
    ...g,
    priorityScore: scoreCrashGroup(g, ctx),
  }));

  return scored.sort(compareCrashGroups);
}

export function rankRawCrashRows(rows: RawCrashRow[], app: string): CrashGroup[] {
  const currentVersion = deriveCurrentVersion(rows);
  const groups = mapRawRowsToCrashGroups(rows, app);
  return rankCrashGroups(groups, currentVersion);
}
