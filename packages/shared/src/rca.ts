import { z } from 'zod';

export const EvidenceSchema = z.object({
  source: z.enum(['serena', 'crashlytics', 'github', 'jira']),
  ref: z.string(),
  detail: z.string(),
});

export const SuspectPRSchema = z.object({
  repo: z.string(),
  number: z.number(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
});

export const RcaReportBodySchema = z.object({
  crashGroupId: z.string(),
  summary: z.string(),
  likelyCause: z.string(),
  suspectPrs: z.array(SuspectPRSchema),
  relatedTicket: z.string().optional(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceSchema),
});

export type RcaReportBody = z.infer<typeof RcaReportBodySchema>;
export type SuspectPR = z.infer<typeof SuspectPRSchema>;

export type RcaReport = RcaReportBody & {
  skillVersion: string;
  model: string;
  costUsd: number;
  createdAt: string;
};

export const GraphEdgeRelationSchema = z.enum([
  'introduced_by',
  'implements',
  'originates_from',
]);

export const GraphEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  relation: GraphEdgeRelationSchema,
  confidence: z.number().min(0).max(1),
  source: z.string(),
  observedAt: z.string(),
});

export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

export const ExplorerSymbolSchema = z.object({
  name: z.string(),
  file: z.string(),
  role: z.string(),
});

export const ExplorerPrSchema = z.object({
  repo: z.string(),
  number: z.number(),
  title: z.string(),
  mergedAt: z.string(),
});

export const ExplorerContextPackageSchema = z.object({
  crashGroupId: z.string(),
  filesTouched: z.array(z.string()),
  symbols: z.array(ExplorerSymbolSchema),
  recentPrs: z.array(ExplorerPrSchema),
  stackSummary: z.string(),
  unknowns: z.array(z.string()),
});

export type ExplorerContextPackage = z.infer<typeof ExplorerContextPackageSchema>;

export function deriveEdgesFromReport(
  report: Pick<RcaReportBody, 'crashGroupId' | 'suspectPrs'>,
  skillVersion: string,
  observedAt: string,
): GraphEdge[] {
  return report.suspectPrs.map((pr: SuspectPR) => ({
    from: `crash:${report.crashGroupId}`,
    to: `pr:${pr.repo}#${pr.number}`,
    relation: 'introduced_by' as const,
    confidence: pr.confidence,
    source: skillVersion,
    observedAt,
  }));
}
