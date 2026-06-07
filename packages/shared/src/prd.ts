import { z } from 'zod';
import { EvidenceSchema, type GraphEdge } from './rca.js';

export const PrdGapCategorySchema = z.enum([
  'acceptance_criteria',
  'edge_cases',
  'analytics',
  'rollout',
  'ownership',
  'scope',
  'other',
]);

export const PrdGapSeveritySchema = z.enum(['info', 'warning', 'critical']);

export const PrdGapSchema = z.object({
  id: z.string(),
  category: PrdGapCategorySchema,
  severity: PrdGapSeveritySchema,
  summary: z.string(),
  detail: z.string(),
  sectionRef: z.string(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceSchema),
});

export type PrdGap = z.infer<typeof PrdGapSchema>;

export const PrdGapReportBodySchema = z.object({
  prdId: z.string(),
  prdTitle: z.string(),
  summary: z.string(),
  gaps: z.array(PrdGapSchema),
  completenessScore: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
});

export type PrdGapReportBody = z.infer<typeof PrdGapReportBodySchema>;

export type PrdGapReport = PrdGapReportBody & {
  skillVersion: string;
  model: string;
  costUsd: number;
  createdAt: string;
};

export const PrdDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  space: z.string(),
  body: z.string(),
  lastModified: z.string(),
});

export type PrdDocument = z.infer<typeof PrdDocumentSchema>;

export const PrdListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  space: z.string(),
  lastModified: z.string(),
  source: z.enum(['mock', 'live']),
});

export type PrdListItem = z.infer<typeof PrdListItemSchema>;

export function derivePrdGapEdges(
  report: Pick<PrdGapReportBody, 'prdId' | 'gaps'>,
  skillVersion: string,
  observedAt: string,
  runId?: string,
): GraphEdge[] {
  const source = runId ? `${skillVersion}:${runId}` : skillVersion;
  return report.gaps.map((gap) => ({
    from: `prd:${report.prdId}`,
    to: `gap:${report.prdId}:${gap.id}`,
    relation: 'has_gap' as const,
    confidence: gap.confidence,
    source,
    observedAt,
  }));
}
