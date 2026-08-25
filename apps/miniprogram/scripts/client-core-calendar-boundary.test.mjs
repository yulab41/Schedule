import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { calendarApiGoldenResponse, holidayApiGoldenResponse } from '@schedule/client-core/testing';
import { describe, expect, it } from 'vitest';

import {
  decodeCalendarReadPayload,
  decodeHolidayReadPayload,
  getCalendarReadPath,
} from '../src/platform/client-core-calendar.js';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
const buildTools = readFileSync(path.join(appRoot, 'scripts', 'build-tools.mjs'), 'utf8');

describe('P2 client-core calendar boundary', () => {
  it('declares and aliases the shared package without adding a Mini business page', () => {
    expect(packageJson.dependencies?.['@schedule/client-core']).toBe('workspace:*');
    expect(buildTools).toContain("'@schedule/client-core': CLIENT_CORE_ENTRY");
    expect(buildTools).not.toContain("'@schedule/contracts':");
  });

  it('decodes the shared golden responses and keeps endpoint paths platform-free', () => {
    expect(decodeCalendarReadPayload(calendarApiGoldenResponse)).toBe(calendarApiGoldenResponse);
    expect(decodeHolidayReadPayload(holidayApiGoldenResponse)).toBe(holidayApiGoldenResponse);
    expect(getCalendarReadPath('group-1', '2026-08')).toBe(
      '/groups/group-1/calendar?businessMonth=2026-08',
    );
  });

  it('exposes the P9 insights runtime client behind the insights capability', async () => {
    const source = readFileSync(
      path.join(appRoot, 'src', 'platform', 'client-core-calendar.ts'),
      'utf8',
    );
    expect(source).toContain('createRuntimeInsightsReadClient');
    expect(source).toContain('createInsightsReadClient');
    expect(source).toContain("createRuntimeWxJsonTransport(getAccessToken, authentication, 'insights')");
    expect(source).toContain('createRuntimeP9InsightsActionsClient');
    expect(source).toContain('createP9InsightsActionsClient');
  });
});
