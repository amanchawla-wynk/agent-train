import { BigQuery } from '@google-cloud/bigquery';
import type { AppConfig } from '../config.js';
import type { ServerConfig } from '../config.js';
import type { CrashlyticsProvider, RawCrashRow } from './types.js';

export interface BigQueryClientLike {
  query(options: { query: string; params?: Record<string, unknown> }): Promise<unknown[][]>;
}

function buildQuery(projectId: string, dataset: string, table: string): string {
  const tableRef = `\`${projectId}.${dataset}.${table}\``;
  return `
    SELECT
      issue_id AS issueId,
      ANY_VALUE(issue_title) AS issueTitle,
      ANY_VALUE(issue_subtitle) AS issueSubtitle,
      COUNT(DISTINCT event_id) AS eventCount,
      COUNT(DISTINCT installation_uuid) AS usersAffected,
      MIN(application.display_version) AS firstSeenVersion,
      MAX(application.display_version) AS latestVersion,
      COUNTIF(event_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)) AS eventsLast24h,
      COUNTIF(
        event_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 48 HOUR)
        AND event_timestamp < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
      ) AS eventsPrev24h
    FROM ${tableRef}
    WHERE event_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @sinceDays DAY)
      AND is_fatal = TRUE
    GROUP BY issue_id
  `;
}

export function mapBigQueryRows(rows: Record<string, unknown>[]): RawCrashRow[] {
  return rows.map((row) => ({
    issueId: String(row.issueId ?? ''),
    issueTitle: String(row.issueTitle ?? ''),
    issueSubtitle: String(row.issueSubtitle ?? ''),
    eventCount: Number(row.eventCount ?? 0),
    usersAffected: Number(row.usersAffected ?? 0),
    eventsLast24h: Number(row.eventsLast24h ?? 0),
    eventsPrev24h: Number(row.eventsPrev24h ?? 0),
    firstSeenVersion: String(row.firstSeenVersion ?? ''),
    latestVersion: String(row.latestVersion ?? ''),
  }));
}

export class BigQueryCrashlyticsProvider implements CrashlyticsProvider {
  constructor(
    private readonly config: ServerConfig,
    private readonly client: BigQueryClientLike,
  ) {}

  async fetchCrashGroups(app: AppConfig, sinceDays: number): Promise<RawCrashRow[]> {
    if (!this.config.bigQueryProjectId) {
      throw new Error('BIGQUERY_PROJECT_ID is required for BigQuery data source');
    }

    const query = buildQuery(
      this.config.bigQueryProjectId,
      this.config.crashlyticsDataset,
      app.bigQueryTable,
    );

    const [rows] = await this.client.query({
      query,
      params: { sinceDays },
    });

    return mapBigQueryRows(rows as Record<string, unknown>[]);
  }
}

export function createBigQueryClient(): BigQueryClientLike {
  const bq = new BigQuery({
    projectId: process.env.BIGQUERY_PROJECT_ID,
  });

  return {
    async query(options) {
      const [job] = await bq.createQueryJob({
        query: options.query,
        params: options.params,
      });
      const [rows] = await job.getQueryResults();
      return [rows];
    },
  };
}
