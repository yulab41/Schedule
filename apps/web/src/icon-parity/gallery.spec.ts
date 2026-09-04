import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const galleryDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(galleryDirectory, '../../../..');

describe('isolated icon parity gallery', () => {
  it('is a standalone entry and does not pull in the authenticated app shell', () => {
    const html = readFileSync(resolve(repositoryRoot, 'apps/web/icon-parity.html'), 'utf8');
    const app = readFileSync(resolve(galleryDirectory, 'App.vue'), 'utf8');

    expect(html).toContain('/src/icon-parity/main.ts');
    expect(app).toContain('iconCatalog');
    expect(app).toContain('iconContextSpecs');
    expect(app).toContain('iconMotionSpecs');
    expect(app).toContain('启动动效');
    expect(app).toContain('停止动效');
    expect(app).toContain('重新启动');
    expect(app).not.toContain("from '../App.vue'");
    expect(app).not.toContain("from '../router");
    expect(app).not.toContain('/api');
  });
});
