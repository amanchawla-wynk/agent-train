import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import type { PrdDocument } from '@agent-train/shared';

const FIXTURE_PRDS: Record<string, PrdDocument> = {
  'playback-redesign': {
    id: 'playback-redesign',
    title: 'Playback Redesign PRD',
    space: 'PRODUCT',
    lastModified: '2026-05-28T10:00:00Z',
    body: `# Playback Redesign PRD

## Overview
Redesign the video playback experience for iOS to improve reliability and reduce crashes.

## Goals
- Reduce playback-related crashes by 30%
- Improve startup time for resumed sessions

## User stories
- As a user, I want playback to resume where I left off.

## Acceptance criteria
- Playback resumes within 2 seconds on app launch.

## Technical notes
- Refactor PlaybackController nullability.

## Analytics
- Track playback_start events.`,
  },
  'onboarding-v2': {
    id: 'onboarding-v2',
    title: 'Onboarding v2 PRD',
    space: 'PRODUCT',
    lastModified: '2026-06-01T14:30:00Z',
    body: `# Onboarding v2 PRD

## Overview
Replace the legacy onboarding flow.

## Acceptance criteria
- Given a fresh install, when the user opens the app, then onboarding starts within 1 second.

## Edge cases
- Offline during onboarding shows cached content.

## Analytics
- onboarding_start, onboarding_complete

## Rollout
- 5% dogfood → 100% over 2 weeks

## Ownership
- PM: Alice Chen`,
  },
};

export function createMockAtlassianTools(): ToolSet {
  const getConfluencePage = tool({
    description: 'Get Confluence page content by page ID (mock)',
    inputSchema: z.object({
      pageId: z.string(),
    }),
    execute: async ({ pageId }) => {
      const doc = FIXTURE_PRDS[pageId];
      if (!doc) {
        return { error: `Unknown page: ${pageId}` };
      }
      return doc;
    },
  });

  return { get_confluence_page: getConfluencePage };
}
