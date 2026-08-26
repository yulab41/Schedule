import { describe, expect, it } from 'vitest';

import * as sharedVisitorAccess from '../../../packages/presentation-core/src/visitor-access.ts';
import * as webEventTimeline from '../../web/src/features/events/event-timeline.ts';

describe('Mini visitor access rules mirror the Web time boundary', () => {
  it('uses the same China-standard timestamp formatter as the Web event surface', () => {
    for (const value of [
      '2026-08-01T16:30:00.000Z',
      '2026-08-03T06:07:08.123Z',
      '2026-12-31T16:00:00.000Z',
    ]) {
      expect(sharedVisitorAccess.formatVisitorAccessDateTime(value)).toBe(
        webEventTimeline.formatEventTime(value),
      );
    }
  });
});
