/* global console, process */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { calendarReadModelSchema, holidayReadModelSchema } from '../../contracts/dist/index.js';
import { z } from 'zod';

import {
  isGeneratedSourceCurrent,
  renderGeneratedSchemas,
  sanitizeJsonSchema,
} from './schema-generation.mjs';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(packageRoot, 'src', 'generated', 'calendar-schemas.ts');
const source = renderGeneratedSchemas({
  calendar: sanitizeJsonSchema(z.toJSONSchema(calendarReadModelSchema), 'calendarReadModel'),
  holidays: sanitizeJsonSchema(z.toJSONSchema(holidayReadModelSchema), 'holidayReadModel'),
});

if (process.argv.includes('--check')) {
  if (
    !existsSync(outputPath) ||
    !isGeneratedSourceCurrent(readFileSync(outputPath, 'utf8'), source)
  ) {
    console.error('[client-core] generated calendar schemas are stale');
    process.exitCode = 1;
  } else {
    console.log('[client-core] generated calendar schemas are current');
  }
} else {
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, source, 'utf8');
  console.log(`[client-core] generated ${outputPath}`);
}
