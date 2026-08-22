import {
  calendarReadModelJsonSchema,
  generatedApiErrorCodes,
  holidayReadModelJsonSchema,
} from '../src/generated/calendar-schemas.js';
import {
  apiErrorCodes,
  calendarReadModelSchema,
  holidayReadModelSchema,
} from '@schedule/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { isGeneratedSourceCurrent, sanitizeJsonSchema } from '../scripts/schema-generation.mjs';

describe('client-core generated schemas', () => {
  it('stay structurally equal to the authoritative Zod contracts', () => {
    expect(calendarReadModelJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(calendarReadModelSchema), 'calendarReadModel'),
    );
    expect(holidayReadModelJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(holidayReadModelSchema), 'holidayReadModel'),
    );
    expect(generatedApiErrorCodes).toEqual(apiErrorCodes);
  });

  it('treats Git CRLF checkout and generated LF source as the same content', () => {
    expect(isGeneratedSourceCurrent('first\r\nsecond\r\n', 'first\nsecond\n')).toBe(true);
    expect(isGeneratedSourceCurrent('first\r\nchanged\r\n', 'first\nsecond\n')).toBe(false);
  });
});
