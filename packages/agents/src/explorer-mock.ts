import type { CrashGroup, ExplorerContextPackage } from '@agent-train/shared';

const FILE_PATTERNS: Record<string, { symbol: string; pr: number; title: string }> = {
  'PlaybackController.swift': {
    symbol: 'PlaybackController.play()',
    pr: 432,
    title: 'Refactor playback controller nullability',
  },
  'NetworkClient.swift': {
    symbol: 'NetworkClient.request()',
    pr: 418,
    title: 'Add retry logic to network client',
  },
  'MovieRepository.swift': {
    symbol: 'MovieRepository.load()',
    pr: 401,
    title: 'Fix movie repository argument validation',
  },
  'OnboardingFlow.swift': {
    symbol: 'OnboardingFlow.start()',
    pr: 510,
    title: 'Beta onboarding flow rewrite',
  },
};

function extractFile(signature: string, title: string): string {
  const fromSignature = signature.match(/([A-Za-z0-9_]+\.swift)/)?.[1];
  if (fromSignature) return fromSignature;

  const fromTitle = title.match(/in ([A-Za-z0-9_]+)/)?.[1];
  if (fromTitle) return `${fromTitle}.swift`;

  return 'Unknown.swift';
}

export function buildMockExplorerPackage(
  crashGroup: CrashGroup,
  githubRepo: string,
  stackSummary?: string,
): ExplorerContextPackage {
  const file = extractFile(crashGroup.signature, crashGroup.title);
  const pattern = FILE_PATTERNS[file] ?? {
    symbol: `${file} (unknown symbol)`,
    pr: 100,
    title: 'Recent change touching crash file',
  };

  return {
    crashGroupId: crashGroup.id,
    filesTouched: [file],
    symbols: [{ name: pattern.symbol, file, role: 'crashing' }],
    recentPrs: [
      {
        repo: githubRepo,
        number: pattern.pr,
        title: pattern.title,
        mergedAt: new Date().toISOString().slice(0, 10),
      },
    ],
    stackSummary:
      stackSummary ??
      `${crashGroup.title} — ${crashGroup.signature}`,
    unknowns: ['Serena MCP unavailable — using mock explorer context'],
  };
}
