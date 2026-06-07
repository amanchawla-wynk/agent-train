import { useCallback, useEffect, useState } from 'react';
import type { CrashGroup, RcaReport } from '@agent-train/shared';
import RcaReportPanel from './RcaReportPanel';
import { scoreTier, tierBadgeClasses } from './scoreTier';

interface AppInfo {
  id: string;
}

interface RcaRunStatus {
  runId: string;
  status: string;
  report: RcaReport | null;
  runLog: {
    phases?: Array<{ phase: string; durationMs: number }>;
    integrationLevel?: string;
  } | null;
  error: string | null;
}

const DAY_OPTIONS = [7, 14, 30] as const;

export default function Dashboard() {
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [selectedApp, setSelectedApp] = useState('');
  const [days, setDays] = useState<number>(7);
  const [groups, setGroups] = useState<CrashGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rcaLoadingId, setRcaLoadingId] = useState<string | null>(null);
  const [rcaError, setRcaError] = useState<string | null>(null);
  const [rcaReport, setRcaReport] = useState<RcaReport | null>(null);
  const [rcaPhases, setRcaPhases] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/apps')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load apps');
        return res.json() as Promise<AppInfo[]>;
      })
      .then((data) => {
        setApps(data);
        if (data[0]) setSelectedApp(data[0].id);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const loadCrashGroups = useCallback(async () => {
    if (!selectedApp) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/crash-groups?app=${encodeURIComponent(selectedApp)}&days=${days}`);
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to load crash groups');
      }
      const data = (await res.json()) as CrashGroup[];
      setGroups(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [selectedApp, days]);

  useEffect(() => {
    if (selectedApp) void loadCrashGroups();
  }, [selectedApp, days, loadCrashGroups]);

  const pollRun = async (runId: string): Promise<RcaReport> => {
    for (let i = 0; i < 120; i++) {
      const res = await fetch(`/api/rca/${runId}`);
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'Failed to poll RCA run');
      }
      const status = (await res.json()) as RcaRunStatus;
      if (status.runLog?.phases) {
        setRcaPhases(status.runLog.phases.map((p) => p.phase));
      }
      if (status.status === 'completed' && status.report) return status.report;
      if (status.status === 'failed' || status.status === 'budget_exceeded') {
        throw new Error(status.error ?? `RCA ${status.status}`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error('RCA timed out');
  };

  const runRca = async (crashGroupId: string) => {
    setRcaLoadingId(crashGroupId);
    setRcaError(null);
    setRcaPhases([]);
    try {
      let res = await fetch('/api/rca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crashGroupId, appId: selectedApp, days }),
      });

      if (res.status === 503) {
        res = await fetch('/api/rca?sync=true', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ crashGroupId, appId: selectedApp, days }),
        });
      }

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? 'RCA failed');
      }

      if (res.status === 202) {
        const body = (await res.json()) as { runId: string };
        const report = await pollRun(body.runId);
        setRcaReport(report);
      } else {
        const report = (await res.json()) as RcaReport;
        setRcaReport(report);
      }
    } catch (err) {
      setRcaError(err instanceof Error ? err.message : 'RCA failed');
    } finally {
      setRcaLoadingId(null);
      setRcaPhases([]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <h1 className="text-2xl font-semibold tracking-tight">Crash Digest</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ranked crash triage queue — regression-weighted priority scoring
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">App</span>
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
            >
              {apps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.id}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Window</span>
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  Last {d} days
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => void loadCrashGroups()}
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

        {rcaError && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {rcaError}
          </div>
        )}

        {rcaPhases.length > 0 && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            RCA phases: {rcaPhases.join(' → ')}
          </div>
        )}

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center text-slate-500">
            Loading crash groups…
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center text-slate-500">
            No crash groups found for this window.
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group, index) => {
              const tier = scoreTier(group.priorityScore);
              const isRunningRca = rcaLoadingId === group.id;
              return (
                <article
                  key={group.id}
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-400">#{index + 1}</span>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tierBadgeClasses(tier)}`}
                      >
                        {group.priorityScore}
                      </span>
                      {group.isRegression && (
                        <span className="inline-flex rounded-full border border-red-300 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                          regression
                        </span>
                      )}
                    </div>
                    <div className="text-right text-sm text-slate-500">
                      <div>{group.app}</div>
                      <div>v{group.latestVersion || 'unknown'}</div>
                    </div>
                  </div>

                  <h2 className="mt-3 text-base font-semibold text-slate-900">{group.title}</h2>
                  <p className="mt-1 font-mono text-sm text-slate-600">{group.signature}</p>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-slate-500">Users affected</dt>
                      <dd className="font-medium">{group.usersAffected.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Events</dt>
                      <dd className="font-medium">{group.eventCount.toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Velocity</dt>
                      <dd className="font-medium">{group.velocityPct.toFixed(1)}%</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">First seen</dt>
                      <dd className="font-medium">v{group.firstSeenVersion || 'unknown'}</dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isRunningRca}
                      onClick={() => void runRca(group.id)}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isRunningRca ? 'Running RCA…' : 'Run RCA'}
                    </button>
                    <button
                      type="button"
                      disabled
                      title="Phase 3"
                      className="cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-400"
                    >
                      Create Jira (Phase 3)
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {rcaReport && (
        <RcaReportPanel report={rcaReport} onClose={() => setRcaReport(null)} />
      )}
    </div>
  );
}
