import { Octokit } from '@octokit/rest';
import { tool, type ToolSet } from 'ai';
import { z } from 'zod';

export async function listRecentPrsTouchingFiles(
  token: string,
  repo: string,
  filePaths: string[],
  sinceDays: number,
): Promise<
  Array<{ repo: string; number: number; title: string; mergedAt: string; files: string[] }>
> {
  const [owner, name] = repo.split('/');
  if (!owner || !name) return [];

  const octokit = new Octokit({ auth: token });
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);

  const { data: pulls } = await octokit.pulls.list({
    owner,
    repo: name,
    state: 'closed',
    sort: 'updated',
    direction: 'desc',
    per_page: 30,
  });

  const merged = pulls.filter(
    (pr) => pr.merged_at && new Date(pr.merged_at) >= since,
  );

  const matches: Array<{
    repo: string;
    number: number;
    title: string;
    mergedAt: string;
    files: string[];
  }> = [];

  for (const pr of merged.slice(0, 15)) {
    const { data: files } = await octokit.pulls.listFiles({
      owner,
      repo: name,
      pull_number: pr.number,
      per_page: 100,
    });

    const touched = files
      .map((f) => f.filename)
      .filter((filename) =>
        filePaths.some(
          (path) =>
            filename === path ||
            filename.endsWith(path) ||
            path.endsWith(filename),
        ),
      );

    if (touched.length > 0) {
      matches.push({
        repo,
        number: pr.number,
        title: pr.title,
        mergedAt: pr.merged_at!,
        files: touched,
      });
    }
  }

  return matches;
}

export function createGithubTools(token: string, defaultRepo: string): ToolSet {
  const octokit = new Octokit({ auth: token });

  const listRecentPrs = tool({
    description:
      'List recently merged pull requests that touched the given file paths in the repository.',
    inputSchema: z.object({
      filePaths: z.array(z.string()).describe('Source file paths to check'),
      sinceDays: z.number().default(14).describe('Look back this many days'),
      repo: z.string().optional().describe(`Repository owner/name, default ${defaultRepo}`),
    }),
    execute: async ({ filePaths, sinceDays, repo }) => {
      const targetRepo = repo ?? defaultRepo;
      const matches = await listRecentPrsTouchingFiles(
        token,
        targetRepo,
        filePaths,
        sinceDays,
      );
      return { repo: targetRepo, matches };
    },
  });

  const getPrSummary = tool({
    description: 'Get summary details for a specific pull request.',
    inputSchema: z.object({
      number: z.number(),
      repo: z.string().optional(),
    }),
    execute: async ({ number, repo }) => {
      const targetRepo = repo ?? defaultRepo;
      const [owner, name] = targetRepo.split('/');
      const { data: pr } = await octokit.pulls.get({
        owner: owner!,
        repo: name!,
        pull_number: number,
      });

      return {
        number: pr.number,
        title: pr.title,
        body: pr.body?.slice(0, 2000) ?? '',
        mergedAt: pr.merged_at,
        author: pr.user?.login,
        url: pr.html_url,
      };
    },
  });

  return { listRecentPrs, getPrSummary };
}
