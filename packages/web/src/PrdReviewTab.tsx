import { useCallback, useEffect, useState } from 'react';
import type { PrdGapReport, PrdListItem } from '@agent-train/shared';
import PrdGapReportPanel from './PrdGapReportPanel';

interface PrdReviewRunStatus {
  runId: string;
  status: string;
  report: PrdGapReport | null;
  runLog: {
    phases?: Array<{ phase: string; durationMs: number }>;
  } | null;
  error: string | null;
}

export default function PrdReviewTab() {
  const [prds, setPrds] = useState<PrdListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewLoadingId, setReviewLoadingId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [report, setReport] = useState<PrdGapReport | null>(null);
  const [phases, setPhases] = useState<string[]>([]);

  const loadPrds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/prds');
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to load PRDs');
      }
      setPrds((await res.json()) as PrdListItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPrds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrds();
  }, [loadPrds]);

  const pollRun = async (runId: string): Promise<PrdGapReport> => {
    for (let i = 0; i < 120; i++) {
      const res = await fetch(`/api/prd-review/${runId}`);
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to poll PRD review');
      }
      const status = (await res.json()) as PrdReviewRunStatus;
      if (status.runLog?.phases) {
        setPhases(status.runLog.phases.map((p) => p.phase));
      }
      if (status.status === 'completed' && status.report) return status.report;
      if (status.status === 'failed' || status.status === 'budget_exceeded') {
        throw new Error(status.error ?? `PRD review ${status.status}`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error('PRD review timed out');
  };

  const runGapReview = async (prdId: string) => {
    setReviewLoadingId(prdId);
    setReviewError(null);
    setPhases([]);
    try {
      let res = await fetch('/api/prd-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prdId }),
      });

      if (res.status === 503) {
        res = await fetch('/api/prd-review?sync=true', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prdId }),
        });
      }

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'PRD review failed');
      }

      if (res.status === 202) {
        const body = (await res.json()) as { runId: string };
        setReport(await pollRun(body.runId));
      } else {
        setReport((await res.json()) as PrdGapReport);
      }
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'PRD review failed');
    } finally {
      setReviewLoadingId(null);
      setPhases([]);
    }
  };

  return (
    <>
      <div className="mb-6 flex items-end justify-between gap-4">
        <p className="text-sm text-slate-600">
          Review Confluence PRDs for missing acceptance criteria, edge cases, analytics, rollout,
          and ownership.
        </p>
        <button
          type="button"
          onClick={() => void loadPrds()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {reviewError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {reviewError}
        </div>
      )}

      {phases.length > 0 && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Review phases: {phases.join(' → ')}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center text-slate-500">
          Loading PRDs…
        </div>
      ) : prds.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center text-slate-500">
          No PRDs configured.
        </div>
      ) : (
        <div className="space-y-3">
          {prds.map((prd) => {
            const isRunning = reviewLoadingId === prd.id;
            return (
              <article
                key={prd.id}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">{prd.title}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {prd.space} · {prd.source} · updated{' '}
                      {new Date(prd.lastModified).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    disabled={isRunning}
                    onClick={() => void runGapReview(prd.id)}
                    className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRunning ? 'Running gap review…' : 'Run gap review'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {report && <PrdGapReportPanel report={report} onClose={() => setReport(null)} />}
    </>
  );
}
