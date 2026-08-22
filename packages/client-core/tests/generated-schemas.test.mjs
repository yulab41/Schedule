import {
  calendarReadModelJsonSchema,
  holidayReadModelJsonSchema,
} from '../src/generated/calendar-schemas.js';
import { calendarReadModelSchema, holidayReadModelSchema } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { sanitizeJsonSchema } from '../scripts/schema-generation.mjs';

describe('client-core generated schemas', () => {
  it('stay structurally equal to the authoritative Zod contracts', () => {
    expect(calendarReadModelJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(calendarReadModelSchema), 'calendarReadModel'),
    );
    expect(holidayReadModelJsonSchema).toEqual(
      sanitizeJsonSchema(z.toJSONSchema(holidayReadModelSchema), 'holidayReadModel'),
    );
  });
});
