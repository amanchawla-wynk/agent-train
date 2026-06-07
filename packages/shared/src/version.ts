/** Strip build metadata like " (123)" or "-beta" suffixes for comparison. */
export function normalizeAppVersion(version: string): string {
  if (!version) return '';
  return version.trim().replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function parseVersionParts(version: string): number[] {
  const normalized = normalizeAppVersion(version);
  if (!normalized) return [];

  const parts = normalized.split(/[.\-_]/);
  const numbers: number[] = [];

  for (const part of parts) {
    const match = part.match(/^(\d+)/);
    if (match) {
      numbers.push(Number(match[1]));
    } else if (part.length > 0) {
      numbers.push(part.charCodeAt(0));
    }
  }

  return numbers;
}

export function compareAppVersion(a: string, b: string): -1 | 0 | 1 {
  const partsA = parseVersionParts(a);
  const partsB = parseVersionParts(b);
  const maxLen = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLen; i++) {
    const va = partsA[i] ?? 0;
    const vb = partsB[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }

  const normA = normalizeAppVersion(a);
  const normB = normalizeAppVersion(b);
  if (normA < normB) return -1;
  if (normA > normB) return 1;
  return 0;
}

export function maxAppVersion(versions: string[]): string {
  const nonEmpty = versions.filter((v) => v && v.trim().length > 0);
  if (nonEmpty.length === 0) return '';

  return nonEmpty.reduce((max, current) =>
    compareAppVersion(current, max) > 0 ? current : max,
  );
}

export function versionRecency(latestVersion: string, currentVersion: string): number {
  if (!latestVersion || !currentVersion) return 0;
  const cmp = compareAppVersion(latestVersion, currentVersion);
  if (cmp >= 0) return 1;
  if (compareAppVersion(latestVersion, normalizeAppVersion(currentVersion)) >= 0) return 0.75;
  return 0.25;
}
