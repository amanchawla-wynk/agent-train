import type { CrashGroup, StackContext } from '@agent-train/shared';
import { StackContextSchema } from '@agent-train/shared';
import type { ToolSet } from 'ai';

function parseFirebaseStack(result: unknown, crashGroup: CrashGroup): StackContext | null {
  if (!result || typeof result !== 'object') return null;
  const data = result as Record<string, unknown>;

  const frames = Array.isArray(data.frames)
    ? (data.frames as string[])
    : Array.isArray(data.stackTrace)
      ? (data.stackTrace as string[])
      : typeof data.stackTrace === 'string'
        ? [data.stackTrace]
        : [];

  const title =
    typeof data.title === 'string' ? data.title : crashGroup.title;
  const issueId =
    typeof data.issueId === 'string' ? data.issueId : crashGroup.id;

  const stackSummary =
    frames.length > 0
      ? `${title} — ${frames[0]}`
      : typeof data.stackTrace === 'string'
        ? `${title} — ${data.stackTrace}`
        : `${crashGroup.title} — ${crashGroup.signature}`;

  return StackContextSchema.parse({
    issueId,
    title,
    stackSummary,
    stackFrames: frames.length > 0 ? frames : [crashGroup.signature],
  });
}

export async function fetchStackContext(
  crashGroup: CrashGroup,
  firebaseTools: ToolSet,
  fallback?: StackContext,
): Promise<StackContext> {
  const getIssue = firebaseTools.get_crash_issue;
  if (getIssue && 'execute' in getIssue && typeof getIssue.execute === 'function') {
    try {
      const result = await (
        getIssue as { execute: (input: { issueId: string }) => Promise<unknown> }
      ).execute({ issueId: crashGroup.id });
      const parsed = parseFirebaseStack(result, crashGroup);
      if (parsed) return parsed;
    } catch (err) {
      console.warn('[stack] Firebase stack fetch failed:', err);
    }
  }

  if (fallback) return fallback;

  return StackContextSchema.parse({
    issueId: crashGroup.id,
    title: crashGroup.title,
    stackSummary: `${crashGroup.title} — ${crashGroup.signature}`,
    stackFrames: [crashGroup.signature],
  });
}
