/** Strip pnpm/npm config env vars so child processes don't invoke npm with unknown keys. */
export function sanitizeSubprocessEnv(
  extra?: Record<string, string>,
): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    const lower = key.toLowerCase();
    if (lower.startsWith('npm_config_')) continue;
    if (lower.startsWith('npm_package_')) continue;
    if (key === 'npm_command' || key === 'npm_lifecycle_event' || key === 'npm_node_execpath') {
      continue;
    }
    env[key] = value;
  }

  if (extra) Object.assign(env, extra);
  return env;
}
