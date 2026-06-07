export interface CrashGroup {
  id: string;
  app: string;
  title: string;
  signature: string;
  usersAffected: number;
  eventCount: number;
  velocityPct: number;
  firstSeenVersion: string;
  latestVersion: string;
  isRegression: boolean;
  priorityScore: number;
}

export type CrashGroupInput = Omit<CrashGroup, 'priorityScore'>;

export interface ScoringContext {
  currentVersion: string;
  usersWeight: number;
  velocityWeight: number;
  regressionWeight: number;
  recencyWeight: number;
}

export const DEFAULT_SCORING_CONTEXT: Omit<ScoringContext, 'currentVersion'> = {
  usersWeight: 1,
  velocityWeight: 1,
  regressionWeight: 4,
  recencyWeight: 1,
};
