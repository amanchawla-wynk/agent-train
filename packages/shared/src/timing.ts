import { compareAppVersion } from './version.js';

/** Higher score when PR merged close to when crash first appeared in a version. */
export function computeTimingScore(
  crashFirstSeenVersion: string,
  prMergedAt: string,
  windowDays = 21,
): number {
  const merged = new Date(prMergedAt);
  if (Number.isNaN(merged.getTime())) return 0.3;

  const now = new Date();
  const daysSinceMerge = (now.getTime() - merged.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceMerge < 0) return 0.2;
  if (daysSinceMerge > windowDays * 2) return 0.25;

  const recency = 1 - Math.min(daysSinceMerge / windowDays, 1);
  const versionBoost =
    crashFirstSeenVersion && compareAppVersion(crashFirstSeenVersion, '0.0.0') > 0
      ? 0.15
      : 0;

  return Math.min(1, Math.max(0, recency * 0.85 + versionBoost));
}

export function computeFilesOverlap(
  prFiles: string[],
  crashFiles: string[],
): string[] {
  return prFiles.filter((pf) =>
    crashFiles.some(
      (cf) => pf === cf || pf.endsWith(cf) || cf.endsWith(pf) || pf.includes(cf),
    ),
  );
}
