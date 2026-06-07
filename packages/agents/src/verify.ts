import type { CrashGroup, ExplorerContextPackage, RcaReportBody } from '@agent-train/shared';
import { Octokit } from '@octokit/rest';

export interface VerificationResult {
  contextPackage: ExplorerContextPackage;
  unknowns: string[];
}

export async function verifyExplorerContext(
  pkg: ExplorerContextPackage,
  crashGroup: CrashGroup,
  githubToken?: string,
): Promise<VerificationResult> {
  const unknowns = [...pkg.unknowns];
  const verifiedPrs = [...pkg.recentPrs];

  if (githubToken) {
    for (const pr of pkg.recentPrs) {
      const valid = await prExists(githubToken, pr.repo, pr.number);
      if (!valid) {
        unknowns.push(`PR ${pr.repo}#${pr.number} could not be verified via GitHub`);
      }
    }
  }

  const frameHits = pkg.stackSummary
    .split(/\s+/)
    .filter((token) => token.includes('.swift'));
  if (frameHits.length === 0 && !crashGroup.signature.includes('.swift')) {
    unknowns.push('No Swift stack frames resolved in context');
  }

  return {
    contextPackage: { ...pkg, recentPrs: verifiedPrs, unknowns },
    unknowns,
  };
}

export function verifyAndCleanReport(
  report: RcaReportBody,
  contextPackage: ExplorerContextPackage,
): RcaReportBody {
  const knownPrKeys = new Set(
    contextPackage.recentPrs.map((pr) => `${pr.repo}#${pr.number}`),
  );
  const knownFiles = new Set(contextPackage.filesTouched);
  const knownFrames = new Set(contextPackage.stackSummary.split(/[\s,—]+/));

  const suspectPrs = report.suspectPrs
    .filter((pr) => {
      const key = `${pr.repo}#${pr.number}`;
      if (knownPrKeys.size > 0 && !knownPrKeys.has(key)) return false;
      return pr.confidence >= 0.3;
    })
    .map((pr) => {
      if (knownPrKeys.has(`${pr.repo}#${pr.number}`)) return pr;
      return { ...pr, confidence: Math.min(pr.confidence, 0.5) };
    });

  const evidence = report.evidence.filter((ev) => {
    if (ev.source === 'github' && ev.ref.startsWith('PR-')) {
      const num = Number(ev.ref.replace('PR-', ''));
      return contextPackage.recentPrs.some((pr) => pr.number === num);
    }
    if (ev.ref.includes('.swift')) {
      return (
        [...knownFiles].some((f) => ev.ref.includes(f)) ||
        [...knownFrames].some((f) => ev.ref.includes(f))
      );
    }
    return true;
  });

  const confidence =
    suspectPrs.length > 0
      ? Math.min(report.confidence, Math.max(...suspectPrs.map((p) => p.confidence)))
      : Math.min(report.confidence, 0.4);

  return {
    ...report,
    suspectPrs,
    evidence,
    confidence,
  };
}

async function prExists(
  token: string,
  repo: string,
  number: number,
): Promise<boolean> {
  const [owner, name] = repo.split('/');
  if (!owner || !name) return false;

  try {
    const octokit = new Octokit({ auth: token });
    await octokit.pulls.get({ owner, repo: name, pull_number: number });
    return true;
  } catch {
    return false;
  }
}
