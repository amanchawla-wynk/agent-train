import type { ExplorerMode } from './types.js';

export type IntegrationLevel = 'full' | 'partial' | 'minimal';

export interface IntegrationLadder {
  level: IntegrationLevel;
  serena: ExplorerMode;
  firebase: 'connected' | 'mock' | 'disconnected';
  github: 'configured' | 'missing';
}

export function resolveIntegrationLevel(input: {
  serenaLive: boolean;
  firebaseLive: boolean;
  githubConfigured: boolean;
}): IntegrationLadder {
  const serena: ExplorerMode = input.serenaLive ? 'live' : 'mock';
  const firebase = input.firebaseLive
    ? 'connected'
    : input.githubConfigured
      ? 'mock'
      : 'disconnected';
  const github = input.githubConfigured ? 'configured' : 'missing';

  let level: IntegrationLevel = 'minimal';
  if (input.serenaLive && input.firebaseLive && input.githubConfigured) {
    level = 'full';
  } else if (input.firebaseLive && input.githubConfigured) {
    level = 'partial';
  } else if (input.githubConfigured) {
    level = 'minimal';
  }

  return { level, serena, firebase, github };
}
