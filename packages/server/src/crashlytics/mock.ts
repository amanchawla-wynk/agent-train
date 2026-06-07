import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppConfig } from '../config.js';
import type { CrashlyticsProvider, RawCrashRow } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../../fixtures/crashes');

export class MockCrashlyticsProvider implements CrashlyticsProvider {
  async fetchCrashGroups(app: AppConfig, _sinceDays: number): Promise<RawCrashRow[]> {
    const fixturePath = join(FIXTURES_DIR, `${app.id}.json`);
    try {
      const raw = await readFile(fixturePath, 'utf-8');
      return JSON.parse(raw) as RawCrashRow[];
    } catch {
      return [];
    }
  }
}
