import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StackContext } from '@agent-train/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface FixtureRow {
  issueId: string;
  issueTitle: string;
  issueSubtitle: string;
}

export async function loadStackFromFixture(
  appId: string,
  crashGroupId: string,
): Promise<StackContext | undefined> {
  const fixturePath = join(__dirname, '../../fixtures/crashes', `${appId}.json`);
  try {
    const raw = await readFile(fixturePath, 'utf-8');
    const rows = JSON.parse(raw) as FixtureRow[];
    const row = rows.find((r) => r.issueId === crashGroupId);
    if (!row) return undefined;

    const frame = row.issueSubtitle.trim();
    const stackFrames = frame ? [frame, row.issueTitle] : [row.issueTitle];

    return {
      issueId: row.issueId,
      title: row.issueTitle,
      stackSummary: `${row.issueTitle} — ${row.issueSubtitle}`,
      stackFrames,
    };
  } catch {
    return undefined;
  }
}
