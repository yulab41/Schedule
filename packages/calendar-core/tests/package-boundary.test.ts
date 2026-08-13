import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const buildScriptPath = fileURLToPath(new URL('../scripts/build.mjs', import.meta.url));
const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const tsconfigBuildPath = fileURLToPath(new URL('../tsconfig.build.json', import.meta.url));
const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;
const require = createRequire(import.meta.url);
const tscScriptPath = require.resolve('typescript/bin/tsc');

beforeAll(() => {
  execFileSync(process.execPath, [buildScriptPath], { cwd: packageRoot, stdio: 'pipe' });
  execFileSync(process.execPath, [tscScriptPath, '-p', tsconfigBuildPath], {
    cwd: packageRoot,
    stdio: 'pipe',
  });
});

describe('calendar-core package boundary', () => {
  it('publishes browser ESM, Node CJS, and an explicit Mini CommonJS entry', () => {
    expect(packageJson).toMatchObject({
      exports: {
        '.': {
          import: './dist/index.js',
          require: './dist/index.cjs',
          types: './dist/index.d.ts',
        },
      },
      main: './dist/miniprogram/index.js',
      miniprogram: './dist/miniprogram/index.js',
      sideEffects: false,
      type: 'module',
    });
    expect(
      JSON.parse(
        readFileSync(new URL('../dist/miniprogram/package.json', import.meta.url), 'utf8'),
      ),
    ).toEqual({ type: 'commonjs' });
  });

  it('emits a self-contained platform-neutral Mini graph', () => {
    const source = readFileSync(new URL('../dist/miniprogram/index.js', import.meta.url), 'utf8');
    const meta = JSON.parse(
      readFileSync(new URL('../dist/miniprogram/meta.json', import.meta.url), 'utf8'),
    ) as {
      readonly inputs: Readonly<Record<string, { readonly imports?: readonly unknown[] }>>;
      readonly outputs: Readonly<
        Record<string, { readonly imports?: readonly { readonly external?: boolean }[] }>
      >;
    };
    expect(Object.keys(meta.inputs).every((path) => path.startsWith('src/'))).toBe(true);
    expect(
      Object.values(meta.inputs)
        .flatMap(({ imports = [] }) => imports)
        .every((entry) =>
          typeof entry === 'object' && entry !== null && 'external' in entry
            ? entry.external !== true
            : true,
        ),
    ).toBe(true);
    expect(
      Object.values(meta.outputs)
        .flatMap(({ imports = [] }) => imports)
        .every(({ external }) => external !== true),
    ).toBe(true);
    expect(source).not.toMatch(
      /\b(?:Buffer|XMLHttpRequest|document|fetch|globalThis|localStorage|navigator|process|self|window|wx)\b/u,
    );
    expect(source).not.toMatch(/(?:@schedule\/contracts|zod|node:)/u);
    expect(Buffer.byteLength(source)).toBeLessThanOrEqual(20 * 1024);
  });

  it('exports the complete shared calendar behavior from CommonJS', () => {
    const commonJs = require(
      fileURLToPath(new URL('../dist/index.cjs', import.meta.url)),
    ) as Record<string, unknown>;
    const runtimeExports = [
      'addBusinessMonths',
      'addWeeks',
      'buildCalendarCacheNotice',
      'buildCalendarMonthViewModel',
      'buildCalendarSurfaceViewModel',
      'buildDayList',
      'buildMonthGrid',
      'createCalendarMonthStateViewModel',
      'createCalendarViewModeState',
      'filterCalendarAssignments',
      'findCalendarPhoneAction',
      'formatChinaDateTime',
      'formatChinaStandardTime',
      'formatShiftTimeRange',
      'getAvailablePhoneActions',
      'getBusinessMonthLabel',
      'getBusinessMonthOf',
      'getBusinessMonthsForWeek',
      'getCalendarMarkerDescription',
      'getCalendarMarkerLabel',
      'getCurrentBusinessDate',
      'getCurrentBusinessMonth',
      'getDutyMemberName',
      'getDutyMembershipId',
      'getHolidayShortLabel',
      'getVisibleWeekForMonth',
      'getWeekDays',
      'getWeekIndexForToday',
      'getWeekLabel',
      'getWeekStartDate',
      'getWeekdayLabel',
      'goCalendarToBusinessMonth',
      'goCalendarToThisWeek',
      'goCalendarToToday',
      'isPastBusinessDate',
      'isWeekend',
      'mergeCalendarFilterViewModels',
      'parseBusinessDate',
      'parseBusinessMonth',
      'recenterCalendarMonthSlots',
      'recenterMonthSlots',
      'rotateMonthSlots',
      'sortCalendarAssignments',
      'stepCalendarMonth',
      'stepCalendarWeek',
      'switchCalendarViewMode',
    ].sort();
    expect(Object.keys(commonJs).sort()).toEqual(runtimeExports);
    for (const name of runtimeExports) {
      expect(commonJs[name], name).toBeTypeOf('function');
    }
  });
});
