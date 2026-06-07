import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

export type Tier = 'explorer' | 'synthesis' | 'review';

export interface LlmConfig {
  explorerModel: string;
  synthesisModel: string;
  reviewModel?: string;
  gatewayBaseUrl?: string;
  gatewayApiKey?: string;
  openaiApiKey?: string;
  googleApiKey?: string;
}

function parseModelRef(ref: string): { provider: string; model: string } {
  const [provider, ...rest] = ref.split(':');
  if (!provider || rest.length === 0) {
    throw new Error(`Invalid model ref "${ref}" — expected "provider:model"`);
  }
  return { provider: provider.toLowerCase(), model: rest.join(':') };
}

function resolveModelRef(tier: Tier, config: LlmConfig): string {
  if (tier === 'explorer') return config.explorerModel;
  if (tier === 'review') return config.reviewModel ?? config.synthesisModel;
  return config.synthesisModel;
}

export function modelIdFor(tier: Tier, config: LlmConfig): string {
  return resolveModelRef(tier, config);
}

export function modelFor(tier: Tier, config: LlmConfig): LanguageModel {
  const ref = resolveModelRef(tier, config);
  const { provider, model } = parseModelRef(ref);

  if (config.gatewayBaseUrl) {
    const gateway = createOpenAI({
      baseURL: config.gatewayBaseUrl,
      apiKey: config.gatewayApiKey ?? 'litellm',
    });
    return gateway(model);
  }

  if (provider === 'openai') {
    const openai = createOpenAI({ apiKey: config.openaiApiKey });
    return openai(model);
  }

  if (provider === 'google') {
    const google = createGoogleGenerativeAI({ apiKey: config.googleApiKey });
    return google(model);
  }

  throw new Error(`Unsupported provider "${provider}" in model ref "${ref}"`);
}

export function loadLlmConfigFromEnv(): LlmConfig {
  return {
    explorerModel: process.env.LLM_EXPLORER ?? 'google:gemini-2.0-flash',
    synthesisModel: process.env.LLM_SYNTHESIS ?? 'openai:gpt-4o',
    reviewModel: process.env.LLM_REVIEW || undefined,
    gatewayBaseUrl: process.env.LLM_GATEWAY_BASE_URL || undefined,
    gatewayApiKey: process.env.LLM_GATEWAY_API_KEY || undefined,
    openaiApiKey: process.env.OPENAI_API_KEY,
    googleApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  };
}
