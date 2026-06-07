import { PrdDocumentSchema, type PrdDocument } from '@agent-train/shared';
import type { ToolSet } from 'ai';

function parseConfluencePage(result: unknown, pageId: string): PrdDocument | null {
  if (!result || typeof result !== 'object') return null;
  const data = result as Record<string, unknown>;

  if (data.error) return null;

  const body =
    typeof data.body === 'string'
      ? data.body
      : typeof data.content === 'string'
        ? data.content
        : '';

  const title = typeof data.title === 'string' ? data.title : pageId;

  return PrdDocumentSchema.parse({
    id: typeof data.id === 'string' ? data.id : pageId,
    title,
    space: typeof data.space === 'string' ? data.space : 'UNKNOWN',
    body,
    lastModified:
      typeof data.lastModified === 'string'
        ? data.lastModified
        : new Date().toISOString(),
  });
}

export async function fetchPrdDocument(input: {
  prdId: string;
  document?: PrdDocument;
  atlassianTools: ToolSet;
}): Promise<PrdDocument> {
  if (input.document) {
    return input.document;
  }

  const getPage = input.atlassianTools.get_confluence_page as
    | { execute?: (args: { pageId: string }, options: unknown) => Promise<unknown> }
    | undefined;

  if (getPage?.execute) {
    const result = await getPage.execute({ pageId: input.prdId }, {});
    const parsed = parseConfluencePage(result, input.prdId);
    if (parsed) return parsed;
  }

  throw new Error(`PRD not found: ${input.prdId}`);
}
