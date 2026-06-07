import type { RcaReport } from '@agent-train/shared';

interface RcaReportPanelProps {
  report: RcaReport;
  onClose: () => void;
}

function confidenceBar(confidence: number): string {
  const pct = Math.round(confidence * 100);
  if (pct >= 80) return 'bg-red-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-slate-400';
}

export default function RcaReportPanel({ report, onClose }: RcaReportPanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold">RCA Report</h2>
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
            <h3 className="text-sm font-medium text-slate-500">Summary</h3>
            <p className="mt-1 text-slate-900">{report.summary}</p>
          </section>

          <section>
            <h3 className="text-sm font-medium text-slate-500">Likely cause</h3>
            <p className="mt-1 text-slate-900">{report.likelyCause}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-slate-500">Overall confidence</span>
              <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full ${confidenceBar(report.confidence)}`}
                  style={{ width: `${report.confidence * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium">{Math.round(report.confidence * 100)}%</span>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-medium text-slate-500">Suspect PRs</h3>
            {report.suspectPrs.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">No suspect PRs identified.</p>
            ) : (
              <ul className="mt-2 space-y-3">
                {report.suspectPrs.map((pr) => (
                  <li
                    key={`${pr.repo}-${pr.number}`}
                    className="rounded-md border border-slate-200 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {pr.repo}#{pr.number}
                      </span>
                      <span className="text-xs text-slate-500">
                        {Math.round(pr.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{pr.reason}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full ${confidenceBar(pr.confidence)}`}
                        style={{ width: `${pr.confidence * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {report.relatedTicket && (
            <section>
              <h3 className="text-sm font-medium text-slate-500">Related ticket</h3>
              <p className="mt-1 font-mono text-sm">{report.relatedTicket}</p>
            </section>
          )}

          <section>
            <h3 className="text-sm font-medium text-slate-500">Evidence</h3>
            <ul className="mt-2 space-y-2">
              {report.evidence.map((ev, i) => (
                <li
                  key={`${ev.ref}-${i}`}
                  className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="mr-2 inline-flex rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium uppercase">
                    {ev.source}
                  </span>
                  <span className="font-mono text-slate-700">{ev.ref}</span>
                  <p className="mt-1 text-slate-600">{ev.detail}</p>
                </li>
              ))}
            </ul>
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
