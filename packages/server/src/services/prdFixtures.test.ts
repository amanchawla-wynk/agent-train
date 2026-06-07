import { describe, expect, it } from 'vitest';
import { listPrdFixtures, loadPrdFixture } from './prdFixtures.js';

describe('prdFixtures', () => {
  it('loads playback-redesign fixture', async () => {
    const doc = await loadPrdFixture('playback-redesign');
    expect(doc?.title).toContain('Playback');
    expect(doc?.body).toContain('Playback Redesign');
  });

  it('lists configured PRDs', async () => {
    const items = await listPrdFixtures(['playback-redesign', 'onboarding-v2']);
    expect(items).toHaveLength(2);
    expect(items[0].source).toBe('mock');
  });
});
