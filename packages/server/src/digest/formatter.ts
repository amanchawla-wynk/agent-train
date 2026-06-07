import type { CrashGroup } from '@agent-train/shared';

export type ScoreTier = 'danger' | 'warning' | 'muted';

export function scoreTier(score: number): ScoreTier {
  if (score >= 80) return 'danger';
  if (score >= 50) return 'warning';
  return 'muted';
}

export function tierLabel(tier: ScoreTier): string {
  switch (tier) {
    case 'danger':
      return 'Critical';
    case 'warning':
      return 'High';
    default:
      return 'Normal';
  }
}

export interface TeamsMessageCard {
  '@type': 'MessageCard';
  '@context': 'https://schema.org/extensions';
  summary: string;
  themeColor: string;
  title: string;
  sections: Array<{
    activityTitle?: string;
    facts: Array<{ name: string; value: string }>;
  }>;
}

export function formatDigestCard(appId: string, groups: CrashGroup[], topN: number): TeamsMessageCard {
  const top = groups.slice(0, topN);
  const hasRegression = top.some((g) => g.isRegression);

  const sections = top.map((group, index) => {
    const tier = scoreTier(group.priorityScore);
    const regressionTag = group.isRegression ? ' [REGRESSION]' : '';
    return {
      activityTitle: `#${index + 1} — Score ${group.priorityScore} (${tierLabel(tier)})${regressionTag}`,
      facts: [
        { name: 'Title', value: group.title },
        { name: 'Signature', value: group.signature },
        { name: 'Version', value: group.latestVersion || 'unknown' },
        { name: 'Users affected', value: String(group.usersAffected) },
        { name: 'Velocity', value: `${group.velocityPct.toFixed(1)}%` },
        { name: 'Events', value: String(group.eventCount) },
      ],
    };
  });

  return {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary: `Crash digest for ${appId}`,
    themeColor: hasRegression ? 'D13438' : '0078D4',
    title: `Daily Crash Digest — ${appId}`,
    sections:
      sections.length > 0
        ? sections
        : [
            {
              facts: [{ name: 'Status', value: 'No crash groups in the selected window.' }],
            },
          ],
  };
}
