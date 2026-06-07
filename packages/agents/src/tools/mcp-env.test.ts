import { describe, expect, it } from 'vitest';
import { sanitizeSubprocessEnv } from './mcp-env.js';

describe('sanitizeSubprocessEnv', () => {
  it('removes npm_config_* variables', () => {
    const original = process.env.npm_config_recursive;
    process.env.npm_config_recursive = 'true';
    process.env.npm_config_verify_deps_before_run = 'false';

    const env = sanitizeSubprocessEnv({ CUSTOM: '1' });

    expect(env.npm_config_recursive).toBeUndefined();
    expect(env.npm_config_verify_deps_before_run).toBeUndefined();
    expect(env.CUSTOM).toBe('1');

    if (original === undefined) {
      delete process.env.npm_config_recursive;
    } else {
      process.env.npm_config_recursive = original;
    }
    delete process.env.npm_config_verify_deps_before_run;
  });
});
