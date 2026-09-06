import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('../infra/scripts/ecs-verify.sh', import.meta.url)),
  'utf8',
);
const bash =
  process.platform === 'win32'
    ? ['C:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/usr/bin/bash.exe'].find(
        existsSync,
      )
    : 'bash';

describe('production checks retain certificate verification', () => {
  it('uses trusted domain TLS with the requested HTTP Host when probing rejected hosts', () => {
    const body = source.match(/status_for_https_host\(\) \{[\s\S]*?\n\}/u)?.[0];
    expect(body).toBeDefined();
    const result = spawnSync(
      bash,
      [
        '--noprofile',
        '--norc',
        '-c',
        `DOMAIN=service.example.test\ncurl() { printf '%s\\n' "$@"; }\n${body}\nstatus_for_https_host rejected.example.test`,
      ],
      { encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(0);
    const args = result.stdout.trim().split(/\r?\n/u);
    expect(args).toContain('service.example.test:443:127.0.0.1');
    expect(args).toContain('https://service.example.test/');
    expect(args).toContain('Host: rejected.example.test');
    expect(args.filter((arg) => /^-[^-]*k/u.test(arg) || arg === '--insecure')).toEqual([]);
  });

  it('does not disable TLS for deployment health, recovery or capability checks', () => {
    for (const file of ['ecs-update.sh', 'ecs-verify.sh']) {
      const shell = readFileSync(
        fileURLToPath(new URL(`../infra/scripts/${file}`, import.meta.url)),
        'utf8',
      );
      expect(shell.match(/curl\s+[^\n]*(?:--insecure|-[a-zA-Z]*k[a-zA-Z]*)/gu)).toBeNull();
    }
  });
});
