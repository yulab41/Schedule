import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const miniprogramRoot = path.join(repositoryRoot, 'apps', 'miniprogram');

function readText(relativePath) {
  return readFileSync(path.join(miniprogramRoot, relativePath), 'utf8');
}

describe('mini-program calendar VM boundary', () => {
  it('renders only view-model fields and keeps Skyline page-level', () => {
    const wxml = readText('pages/calendar/index.wxml');
    const page = readText('pages/calendar/index.ts');
    const wxss = readText('pages/calendar/index.wxss');
    expect(wxml).toContain('viewModel.');
    expect(wxml).not.toMatch(
      /actualMemberName|plannedMemberName|changeMarkers|shiftTypeColor|shiftTypeTextColor/gu,
    );
    expect(page).toContain('createCalendarPageController');
    expect(page).not.toMatch(/Promise\.all|requestGeneration|lastSuccessfulKey|inFlight/gu);
    expect(readText('pages/calendar/index.json')).toMatch(/"renderer"\s*:\s*"skyline"/u);
    expect(readText('pages/calendar/index.json')).not.toContain('t-calendar');
    expect(wxml).not.toMatch(/enhanced=|show-scrollbar=/gu);
    expect(wxss).toContain('.calendar-page__toolbar');
    expect(wxss).toContain('flex: 0 0 auto');
    expect(wxss).toContain('margin: 0');
    expect(wxss).toContain('width: 128rpx');
    expect(wxss).toContain('white-space: nowrap');
    expect(wxss).toContain('display: flex');
    expect(wxss).toContain('display: block');
    expect(wxss).toContain(':active');
    expect(wxss).not.toMatch(/constant\(|display:\s*grid|place-items|:focus/gu);
  });

  it('does not synthesize unsupported marker contract fields', () => {
    expect(readText('features/calendar/calendar-view-model.ts')).not.toMatch(/eventId|deduction/gu);
  });
});
