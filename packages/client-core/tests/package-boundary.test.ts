import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as {
  readonly exports: {
    readonly '.': { readonly import: string; readonly require: string; readonly types: string };
  };
  readonly main: string;
  readonly miniprogram: string;
  readonly type: string;
};
const buildSource = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
const buildScriptPath = fileURLToPath(new URL('../scripts/build.mjs', import.meta.url));

beforeAll(() => {
  execFileSync(process.execPath, [buildScriptPath], { stdio: 'pipe' });
});

describe('client-core package boundary', () => {
  it('keeps ESM and Node require exports while exposing a DevTools-compatible Mini entry', () => {
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
      type: 'module',
    });
  });

  it('builds the Mini .js entry inside an explicit CommonJS package boundary', () => {
    expect(buildSource).toContain("'../dist/miniprogram/index.js'");
    expect(buildSource).toContain("'../dist/miniprogram/package.json'");
    expect(buildSource).toContain("JSON.stringify({ type: 'commonjs' })");
  });

  it('emits syntax accepted by the Stable DevTools parser', () => {
    const miniProgramBundle = readFileSync(
      new URL('../dist/miniprogram/index.js', import.meta.url),
      'utf8',
    );

    expect(miniProgramBundle).not.toMatch(/catch\s*\{/u);
  });

  it('emits an auditable Mini graph without external or platform imports', () => {
    const meta = JSON.parse(
      readFileSync(new URL('../dist/miniprogram/meta.json', import.meta.url), 'utf8'),
    ) as {
      readonly inputs: Readonly<Record<string, unknown>>;
      readonly outputs: Readonly<
        Record<string, { readonly imports?: readonly { readonly external?: boolean }[] }>
      >;
    };
    const inputPaths = Object.keys(meta.inputs);
    const outputImports = Object.values(meta.outputs).flatMap((output) => output.imports ?? []);

    expect(inputPaths.length).toBeGreaterThan(0);
    expect(inputPaths.every((inputPath) => inputPath.startsWith('src/'))).toBe(true);
    expect(outputImports.every((entry) => entry.external !== true)).toBe(true);
  });
});
