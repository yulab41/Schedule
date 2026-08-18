import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const generatorPath = fileURLToPath(new URL('../scripts/generate-tokens-css.mjs', import.meta.url));

function generateStylesheet(format: 'css' | 'wxss'): string {
  return execFileSync(process.execPath, [generatorPath, '--stdout', `--format=${format}`], {
    encoding: 'utf8',
  });
}

describe('tokens stylesheet generation', () => {
  it('keeps the committed tokens.css identical to the generator output', () => {
    const generated = generateStylesheet('css');
    const committed = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
    expect(committed).toBe(generated);
  });

  it('keeps CSS and WXSS declarations on the same token source', () => {
    const generatedCss = generateStylesheet('css');
    const generatedWxss = generateStylesheet('wxss');
    const committedWxss = readFileSync(new URL('./tokens.wxss', import.meta.url), 'utf8');

    expect(committedWxss).toBe(generatedWxss);
    expect(generatedCss.startsWith(':root {\n')).toBe(true);
    expect(generatedWxss.startsWith('page {\n')).toBe(true);
    expect(generatedWxss.slice('page'.length)).toBe(generatedCss.slice(':root'.length));
  });
});
