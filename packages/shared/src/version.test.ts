import { describe, expect, it } from 'vitest';
import { compareAppVersion, maxAppVersion, normalizeAppVersion } from './version.js';

describe('compareAppVersion', () => {
  it('compares semver tuples', () => {
    expect(compareAppVersion('2.4.0', '2.5.0')).toBe(-1);
    expect(compareAppVersion('2.5.0', '2.4.0')).toBe(1);
    expect(compareAppVersion('2.5.0', '2.5.0')).toBe(0);
  });

  it('strips build metadata', () => {
    expect(compareAppVersion('2.5.0 (123)', '2.5.0')).toBe(0);
    expect(normalizeAppVersion('2.5.0 (456)')).toBe('2.5.0');
  });
});

describe('maxAppVersion', () => {
  it('returns highest version', () => {
    expect(maxAppVersion(['2.3.0', '2.5.0 (100)', '2.4.1'])).toBe('2.5.0 (100)');
  });

  it('returns empty string for empty input', () => {
    expect(maxAppVersion([])).toBe('');
    expect(maxAppVersion(['', '  '])).toBe('');
  });
});
