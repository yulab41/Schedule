import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const scriptPath = fileURLToPath(new URL('./schedule-notifications.sh', import.meta.url));

describe('production recurring jobs', () => {
  it('runs pending export jobs from the every-minute worker', async () => {
    const script = await readFile(scriptPath, 'utf8');

    expect(script).toContain('compose_run export-jobs');
  });
});
