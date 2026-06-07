import type { CrashGroup } from '@agent-train/shared';
import { appAgentConfigFromApp, type RcaInput } from '@agent-train/agents';
import type { AppConfig, ServerConfig } from '../config.js';
import { buildRelatedHistoryForCrash } from '../db/graph.js';
import { loadStackFromFixture } from './stackFixtures.js';

export async function prepareRcaInput(
  crashGroup: CrashGroup,
  app: AppConfig,
  config: ServerConfig,
): Promise<RcaInput> {
  const stackContext = await loadStackFromFixture(app.id, crashGroup.id);

  let relatedHistory: RcaInput['relatedHistory'] = [];
  if (config.databaseUrl) {
    try {
      relatedHistory = await buildRelatedHistoryForCrash(crashGroup.id);
    } catch (err) {
      console.warn('[rca] Graph warm-start failed:', err);
    }
  }

  return {
    crashGroup,
    app: appAgentConfigFromApp(app),
    stackContext,
    relatedHistory,
  };
}
