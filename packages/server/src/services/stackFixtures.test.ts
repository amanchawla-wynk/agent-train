import { describe, expect, it } from 'vitest';
import { loadStackFromFixture } from './stackFixtures.js';

describe('loadStackFromFixture', () => {
  it('loads stack for known crash group', async () => {
    const stack = await loadStackFromFixture('ios_main', 'regression-001');
    expect(stack).toBeDefined();
    expect(stack?.stackFrames[0]).toContain('PlaybackController.swift');
    expect(stack?.stackSummary).toContain('EXC_BAD_ACCESS');
  });

  it('returns undefined for unknown crash', async () => {
    const stack = await loadStackFromFixture('ios_main', 'missing-id');
    expect(stack).toBeUndefined();
  });
});
