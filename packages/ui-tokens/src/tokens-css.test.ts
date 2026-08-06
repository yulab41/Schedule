import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const generatorPath = fileURLToPath(new URL('../scripts/generate-tokens-css.mjs', import.meta.url));

describe('tokens stylesheet generation', () => {
  it('keeps the committed tokens.css identical to the generator output', () => {
    const generated = execFileSync(process.execPath, [generatorPath, '--stdout'], {
      encoding: 'utf8',
    });
    const committed = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
    expect(committed).toBe(generated);
  });
});
