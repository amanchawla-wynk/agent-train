import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreCrashGroup } from '@agent-train/shared';
import { buildMockExplorerPackage } from '../explorer-mock.js';
import { verifyAndCleanReport } from '../verify.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface GoldenCase {
  id: string;
  appId: string;
  crashTitle: string;
  expectedPrNumbers: number[];
  minEvidenceCount: number;
}

function mockCrashGroup(c: GoldenCase) {
  const base = {
    id: c.id,
    app: c.appId,
    title: c.crashTitle,
    signature: c.crashTitle.includes('PlaybackController')
      ? 'PlaybackController.swift:142'
      : c.crashTitle.includes('NetworkClient')
        ? 'NetworkClient.swift:55'
        : 'MovieRepository.swift:88',
    usersAffected: 100,
    eventCount: 200,
    velocityPct: 50,
    firstSeenVersion: '2.5.0',
    latestVersion: '2.5.0',
    isRegression: true,
  };
  return { ...base, priorityScore: scoreCrashGroup(base) };
}

async function main(): Promise<void> {
  const fixturePath = join(__dirname, 'fixtures/golden-rca.json');
  const cases = JSON.parse(await readFile(fixturePath, 'utf-8')) as GoldenCase[];

  let recallAt1 = 0;
  let evidenceOk = 0;

  for (const c of cases) {
    const crash = mockCrashGroup(c);
    const pkg = buildMockExplorerPackage(crash, 'myorg/ios-app');
    const topPr = pkg.recentPrs[0]?.number;

    const hit = c.expectedPrNumbers.includes(topPr);
    if (hit) recallAt1++;

    const mockReport = {
      crashGroupId: c.id,
      summary: pkg.summary,
      likelyCause: pkg.summary,
      suspectPrs: pkg.recentPrs.map((pr) => ({
        repo: pr.repo,
        number: pr.number,
        reason: pr.title,
        confidence: 0.85,
      })),
      confidence: 0.85,
      evidence: [
        {
          source: 'github' as const,
          ref: `PR-${topPr}`,
          detail: pkg.summary,
        },
      ],
    };

    const cleaned = verifyAndCleanReport(mockReport, pkg);
    if (cleaned.evidence.length >= c.minEvidenceCount) evidenceOk++;
  }

  const total = cases.length;
  console.log('RCA eval (mock explorer)');
  console.log(`Cases: ${total}`);
  console.log(`PR recall@1: ${(recallAt1 / total * 100).toFixed(1)}% (${recallAt1}/${total})`);
  console.log(`Evidence completeness: ${(evidenceOk / total * 100).toFixed(1)}% (${evidenceOk}/${total})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
