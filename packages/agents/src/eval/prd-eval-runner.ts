import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMockAtlassianTools } from '../tools/atlassian-mock.js';
import { fetchPrdDocument } from '../prd-fetch.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface GoldenPrdCase {
  prdId: string;
  expectedCategories: string[];
  minGaps: number;
  maxGaps?: number;
}

function detectGapsHeuristic(body: string): string[] {
  const gaps: string[] = [];
  const lower = body.toLowerCase();

  if (!lower.includes('## rollout') && !lower.includes('rollout')) {
    gaps.push('rollout');
  }
  if (!lower.includes('## edge cases') && !lower.includes('edge case')) {
    gaps.push('edge_cases');
  }
  if (!lower.includes('## ownership') && !lower.includes('ownership')) {
    gaps.push('ownership');
  }
  if (!lower.includes('acceptance criteria') || (lower.match(/acceptance criteria/g) ?? []).length < 2) {
    gaps.push('acceptance_criteria');
  }

  return gaps;
}

async function main(): Promise<void> {
  const fixturePath = join(__dirname, 'fixtures/golden-prd-gaps.json');
  const cases = JSON.parse(await readFile(fixturePath, 'utf-8')) as GoldenPrdCase[];
  const tools = createMockAtlassianTools();

  let categoryHits = 0;
  let categoryTotal = 0;
  let gapCountOk = 0;

  for (const c of cases) {
    const doc = await fetchPrdDocument({
      prdId: c.prdId,
      atlassianTools: tools,
    });
    const detected = detectGapsHeuristic(doc.body);

    for (const cat of c.expectedCategories) {
      categoryTotal++;
      if (detected.includes(cat)) categoryHits++;
    }

    const gapOk =
      detected.length >= c.minGaps &&
      (c.maxGaps === undefined || detected.length <= c.maxGaps);
    if (gapOk) gapCountOk++;
  }

  const total = cases.length;
  console.log('PRD gap eval (heuristic on mock fixtures)');
  console.log(`Cases: ${total}`);
  if (categoryTotal > 0) {
    console.log(
      `Category recall: ${((categoryHits / categoryTotal) * 100).toFixed(1)}% (${categoryHits}/${categoryTotal})`,
    );
  }
  console.log(
    `Gap count accuracy: ${((gapCountOk / total) * 100).toFixed(1)}% (${gapCountOk}/${total})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
