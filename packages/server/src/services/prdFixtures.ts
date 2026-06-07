import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrdDocument, PrdListItem } from '@agent-train/shared';
import { PrdDocumentSchema } from '@agent-train/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadPrdFixture(prdId: string): Promise<PrdDocument | undefined> {
  const fixturePath = join(__dirname, '../../fixtures/prds', `${prdId}.json`);
  try {
    const raw = await readFile(fixturePath, 'utf-8');
    const parsed = PrdDocumentSchema.parse(JSON.parse(raw));
    return parsed;
  } catch {
    return undefined;
  }
}

export async function listPrdFixtures(prdIds: string[]): Promise<PrdListItem[]> {
  const items: PrdListItem[] = [];

  for (const id of prdIds) {
    const doc = await loadPrdFixture(id);
    if (doc) {
      items.push({
        id: doc.id,
        title: doc.title,
        space: doc.space,
        lastModified: doc.lastModified,
        source: 'mock',
      });
    }
  }

  return items;
}
