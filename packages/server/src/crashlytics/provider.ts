import type { ServerConfig } from '../config.js';
import { BigQueryCrashlyticsProvider, createBigQueryClient } from './bigquery.js';
import { MockCrashlyticsProvider } from './mock.js';
import type { CrashlyticsProvider } from './types.js';

export function createCrashlyticsProvider(config: ServerConfig): CrashlyticsProvider {
  if (config.dataSource === 'bigquery') {
    return new BigQueryCrashlyticsProvider(config, createBigQueryClient());
  }
  return new MockCrashlyticsProvider();
}
