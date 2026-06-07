import type { CrashGroup } from '@agent-train/shared';
import { formatDigestCard } from './formatter.js';

export async function postDigestToTeams(
  webhookUrl: string,
  appId: string,
  groups: CrashGroup[],
  topN: number,
): Promise<void> {
  if (!webhookUrl) {
    console.warn('[digest] DIGEST_WEBHOOK_URL not set — skipping Teams post');
    return;
  }

  const card = formatDigestCard(appId, groups, topN);
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Teams webhook failed (${response.status}): ${body}`);
  }
}
