import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const miniprogramRoot = path.join(root, 'apps', 'miniprogram');

function read(relativePath) {
  return readFileSync(path.join(miniprogramRoot, relativePath), 'utf8');
}

describe('manual schedule Web parity boundary', () => {
  const pagePath = 'subpackages/manual-schedule/pages/editor/index';

  it('exposes the Web configuration controls and a custom-navigation back action', () => {
    const page = read(`${pagePath}.ts`);
    const wxml = read(`${pagePath}.wxml`);

    expect(wxml).toContain('show-back="{{true}}"');
    expect(wxml).toContain('bindchange="handleTemplate"');
    expect(wxml).toContain('bindchange="handleRole"');
    expect(wxml).toContain('bindchange="handleStartDate"');
    expect(wxml).toContain('bindchange="handleCycleDays"');
    expect(wxml).toContain('bindchange="handleMembers"');
    expect(wxml).toContain('mode="date"');
    expect(wxml).toContain('<checkbox-group');
    expect(page).toMatch(
      /const previousDraft = controller\.state\.draft;[\s\S]*if \(previousDraft === undefined\)[\s\S]*controller\.refreshHolidays\(\)/u,
    );
  });

  it('keeps all shifts for saved-cell lookup but only sends enabled shifts to the palette', () => {
    const page = read(`${pagePath}.ts`);
    const wxml = read(`${pagePath}.wxml`);

    expect(page).toMatch(/const allShifts\s*=/u);
    expect(page).toMatch(/availableShifts:\s*allShifts\.filter\(\(shift\) => shift\.isEnabled\)/u);
    expect(page).toContain('isManualTemplateCellSnapshotCurrent(cell, savedCell)');
    expect(wxml).toContain('shifts="{{availableShifts}}"');
  });
});
