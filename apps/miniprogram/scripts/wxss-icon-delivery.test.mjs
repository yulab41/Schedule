import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';
import { ARTIFACT_ROOT, SOURCE_ROOT, buildMiniProgram } from './build-tools.mjs';

it('delivers the canonical phone as a WXSS data URI, without a local image fetch per row', async () => {
  const output = path.join(ARTIFACT_ROOT, 'list-phone-delivery');
  await buildMiniProgram({ profile: 'production', outdir: output });
  const styles = readFileSync(path.join(output, 'pages/workbench/index.wxss'), 'utf8');
  const phone = styles.match(/\.list-call-action::before\s*\{([^}]+)\}/su)?.[1];
  expect(phone).toBeDefined();
  expect(phone).not.toContain("url('/assets/");
  const encoded = phone.match(/data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/u)?.[1];
  expect(encoded).toBeDefined();
  expect(Buffer.from(encoded, 'base64').toString('utf8')).toBe(
    readFileSync(path.join(SOURCE_ROOT, 'assets/icons/ui-phone-success.svg'), 'utf8'),
  );
  expect(phone).toMatch(/width:\s*20px/u);
  expect(phone).toMatch(/height:\s*20px/u);
}, 20000);
