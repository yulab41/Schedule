import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MAX_MANUAL_CELLS,
  MAX_MANUAL_DAYS,
  MAX_MANUAL_MEMBERS,
} from '@schedule/contracts/manual-schedule-limits';
import { describe, expect, it } from 'vitest';

import { createManualMatrixPocViewModel } from '../src/testing/fixtures/manual-matrix-poc.js';
import { ARTIFACT_ROOT, buildMiniProgram } from './build-tools.mjs';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
const buildTools = readFileSync(path.join(appRoot, 'scripts', 'build-tools.mjs'), 'utf8');
const fixtureSource = readFileSync(
  path.join(appRoot, 'src', 'testing', 'fixtures', 'manual-matrix-poc.ts'),
  'utf8',
);

describe('P5 manual scheduling limit boundary', () => {
  it('keeps the maximum native matrix on the shared 20 by 30 by 600 contract', () => {
    const maximum = createManualMatrixPocViewModel('maximum');

    expect(MAX_MANUAL_MEMBERS).toBe(20);
    expect(MAX_MANUAL_DAYS).toBe(30);
    expect(MAX_MANUAL_CELLS).toBe(600);
    expect(maximum.rows).toHaveLength(MAX_MANUAL_MEMBERS);
    expect(maximum.columns).toHaveLength(MAX_MANUAL_DAYS);
    expect(maximum.logicalCellCount).toBe(MAX_MANUAL_CELLS);
  });

  it('imports only the Zod-free contracts leaf from Mini source and its source alias', () => {
    expect(packageJson.dependencies?.['@schedule/contracts']).toBe('workspace:*');
    expect(fixtureSource).toContain("from '@schedule/contracts/manual-schedule-limits'");
    expect(buildTools).toContain(
      "'@schedule/contracts/manual-schedule-limits': CONTRACTS_MANUAL_SCHEDULE_LIMITS_ENTRY",
    );
    expect(buildTools).not.toContain("'@schedule/contracts':");
  });

  it('bundles the real Mini source with only the approved contracts leaf', async () => {
    mkdirSync(ARTIFACT_ROOT, { recursive: true });
    const fixtureRoot = mkdtempSync(path.join(ARTIFACT_ROOT, 'p5-contracts-boundary-'));
    try {
      const result = await buildMiniProgram({
        buildCommit: 'abc1234',
        buildVersion: 'p5-contracts-boundary',
        outdir: path.join(fixtureRoot, 'out'),
        profile: 'production',
      });
      const inputs = Object.keys(result.metafile.inputs).map((input) =>
        input.replaceAll('\\', '/'),
      );
      const contractsInputs = inputs.filter((input) => input.includes('packages/contracts/'));

      expect(contractsInputs).toHaveLength(2);
      expect(contractsInputs).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/packages\/contracts\/src\/manual-schedule-limits\.ts$/u),
          expect.stringMatching(/packages\/contracts\/src\/past-schedule-limits\.ts$/u),
        ]),
      );
      expect(inputs.some((input) => input.endsWith('/packages/contracts/src/index.ts'))).toBe(
        false,
      );
      expect(inputs.some((input) => input.includes('/zod/'))).toBe(false);
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true });
    }
  });
});
