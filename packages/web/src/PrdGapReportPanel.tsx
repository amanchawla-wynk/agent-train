import type { PrdGapReport } from '@agent-train/shared';

interface PrdGapReportPanelProps {
  report: PrdGapReport;
  onClose: () => void;
}

function severityClasses(severity: string): string {
  if (severity === 'critical') return 'border-red-300 bg-red-50 text-red-800';
  if (severity === 'warning') return 'border-amber-300 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

export default function PrdGapReportPanel({ report, onClose }: PrdGapReportPanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold">PRD Gap Report</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <section>
            <h3 className="text-sm font-medium text-slate-500">PRD</h3>
            <p className="mt-1 font-medium text-slate-900">{report.prdTitle}</p>
            <p className="text-xs text-slate-400">{report.prdId}</p>
          </section>

          <section>
            <h3 className="text-sm font-medium text-slate-500">Summary</h3>
            <p className="mt-1 text-slate-900">{report.summary}</p>
            <div className="mt-2 flex items-center gap-4 text-sm">
              <span>
                Completeness:{' '}
                <strong>{Math.round(report.completenessScore * 100)}%</strong>
              </span>
              <span>
                Confidence: <strong>{Math.round(report.confidence * 100)}%</strong>
              </span>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-medium text-slate-500">Gaps</h3>
            {report.gaps.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">No gaps identified.</p>
            ) : (
              <ul className="mt-2 space-y-3">
                {report.gaps.map((gap) => (
                  <li
                    key={gap.id}
                    className={`rounded-md border p-3 ${severityClasses(gap.severity)}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{gap.summary}</span>
                      <span className="text-xs uppercase">{gap.severity}</span>
                    </div>
                    <p className="mt-1 text-sm opacity-90">{gap.detail}</p>
                    <p className="mt-2 text-xs">
                      {gap.category} · {gap.sectionRef} ·{' '}
                      {Math.round(gap.confidence * 100)}% confidence
                    </p>
                    {gap.evidence.length > 0 && (
                      <ul className="mt-2 space-y-1 text-xs">
                        {gap.evidence.map((ev, i) => (
                          <li key={`${ev.ref}-${i}`}>
                            [{ev.source}] {ev.ref}: {ev.detail}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <footer className="border-t border-slate-100 pt-4 text-xs text-slate-400">
            Model: {report.model} · Skill: {report.skillVersion} · Cost: $
            {report.costUsd.toFixed(4)} · {new Date(report.createdAt).toLocaleString()}
          </footer>
        </div>
      </div>
    </div>
  );
}
