import { describe, expect, it, vi } from 'vitest';
import { BigQueryCrashlyticsProvider, mapBigQueryRows } from './bigquery.js';
import type { ServerConfig } from '../config.js';

describe('mapBigQueryRows', () => {
  it('maps BigQuery result rows to RawCrashRow', () => {
    const rows = mapBigQueryRows([
      {
        issueId: 'abc',
        issueTitle: 'Crash',
        issueSubtitle: 'File.swift',
        eventCount: 10,
        usersAffected: 5,
        eventsLast24h: 3,
        eventsPrev24h: 1,
        firstSeenVersion: '1.0.0',
        latestVersion: '1.1.0',
      },
    ]);

    expect(rows[0]).toEqual({
      issueId: 'abc',
      issueTitle: 'Crash',
      issueSubtitle: 'File.swift',
      eventCount: 10,
      usersAffected: 5,
      eventsLast24h: 3,
      eventsPrev24h: 1,
      firstSeenVersion: '1.0.0',
      latestVersion: '1.1.0',
    });
  });
});

describe('BigQueryCrashlyticsProvider', () => {
  it('fetches and maps crash groups via injected client', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue([
        [
          {
            issueId: 'issue-1',
            issueTitle: 'Fatal',
            issueSubtitle: 'X.swift',
            eventCount: 20,
            usersAffected: 8,
            eventsLast24h: 5,
            eventsPrev24h: 2,
            firstSeenVersion: '2.0.0',
            latestVersion: '2.1.0',
          },
        ],
      ]),
    };

    const config: ServerConfig = {
      port: 3001,
      dataSource: 'bigquery',
      bigQueryProjectId: 'test-project',
      crashlyticsDataset: 'firebase_crashlytics',
      apps: [{ id: 'ios_main', bigQueryTable: 'com.example.app_IOS' }],
      digestWebhookUrl: '',
      digestTopN: 10,
      digestCron: '0 9 * * *',
    };

    const provider = new BigQueryCrashlyticsProvider(config, mockClient);
    const rows = await provider.fetchCrashGroups(
      { id: 'ios_main', bigQueryTable: 'com.example.app_IOS' },
      7,
    );

    expect(mockClient.query).toHaveBeenCalledOnce();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.issueId).toBe('issue-1');
  });

  it('throws when project id is missing', async () => {
    const config: ServerConfig = {
      port: 3001,
      dataSource: 'bigquery',
      bigQueryProjectId: '',
      crashlyticsDataset: 'firebase_crashlytics',
      apps: [],
      digestWebhookUrl: '',
      digestTopN: 10,
      digestCron: '0 9 * * *',
    };

    const provider = new BigQueryCrashlyticsProvider(config, { query: vi.fn() });
    await expect(
      provider.fetchCrashGroups({ id: 'ios_main', bigQueryTable: 't' }, 7),
    ).rejects.toThrow('BIGQUERY_PROJECT_ID');
  });
});
