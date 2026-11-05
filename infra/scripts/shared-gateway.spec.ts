import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('shared gateway release boundary', () => {
  it('preserves the already active AI site when the next Schedule release replaces the gateway', async () => {
    const nginx = await readFile('infra/docker/nginx.prod.conf', 'utf8');
    const hasRegisteredSite =
      nginx.includes('include /etc/letsencrypt/aitool/ingress.conf;') ||
      nginx.includes('server_name aitool.eylinhome.top;');
    expect(hasRegisteredSite).toBe(true);
    expect(nginx).toContain('ssl_reject_handshake on;');
    expect(nginx).toContain('server_name hosp.schedule.eylinhome.top;');
  });
});
