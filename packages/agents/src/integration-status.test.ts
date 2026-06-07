import { describe, expect, it } from 'vitest';
import { resolveIntegrationLevel } from './integration-status.js';

describe('resolveIntegrationLevel', () => {
  it('returns full when all integrations live', () => {
    expect(
      resolveIntegrationLevel({
        serenaLive: true,
        firebaseLive: true,
        githubConfigured: true,
      }).level,
    ).toBe('full');
  });

  it('returns minimal with github only', () => {
    expect(
      resolveIntegrationLevel({
        serenaLive: false,
        firebaseLive: false,
        githubConfigured: true,
      }).level,
    ).toBe('minimal');
  });
});
