import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = await readFile(
  fileURLToPath(new URL('./client-version-allowlist.sh', import.meta.url)),
  'utf8',
);

describe('production Mini client version allowlist control', () => {
  it('supports only idempotent ensure and read-only verify commands', () => {
    expect(source).toContain('ensure)');
    expect(source).toContain('verify)');
    expect(source).not.toMatch(/\bremove\)|\bdelete\)/u);
    expect(source).toContain('请求的版本已存在并通过验证；未重建容器');
  });

  it('takes release then capability locks before mutating the environment', () => {
    const releaseLock = source.indexOf('/var/lock/schedule-release.lock');
    const capabilityLock = source.indexOf('/var/lock/schedule-client-capability.lock');
    const mutation = source.indexOf('write_version_list "$FINAL_LIST"');

    expect(releaseLock).toBeGreaterThan(-1);
    expect(capabilityLock).toBeGreaterThan(releaseLock);
    expect(mutation).toBeGreaterThan(capabilityLock);
  });

  it('uses root-owned atomic writes without sourcing or printing the secret environment', () => {
    expect(source).toContain("stat -c '%u:%g/%a'");
    expect(source).toContain('0:0/600');
    expect(source).toContain('mktemp "$DEPLOY_DIR/.env.production.client-versions.XXXXXX"');
    expect(source).toContain('chown 0:0 "$NEXT_ENV"');
    expect(source).toContain('chmod 0600 "$NEXT_ENV"');
    expect(source).toContain('mv -fT -- "$NEXT_ENV" "$ENV_FILE"');
    expect(source).not.toMatch(/(?:^|\n)\s*(?:source|\.)\s+[^\n]*\.env\.production/u);
    expect(source).not.toContain('set -x');
    expect(source).not.toMatch(/cat\s+[^\n]*ENV_FILE/u);
  });

  it('recreates API and Web, waits for health, and probes policy by exact values', () => {
    expect(source).toContain('up -d --force-recreate api web');
    expect(source).toContain('for attempt in $(seq 1 30)');
    expect(source).toContain('Object.keys(actual).sort()');
    expect(source).toContain('keys.every((key) => actual[key] === expected[key])');
    expect(source).toContain('choose_unknown_version');
    expect(source).toContain('[ "$status" = "426" ]');
    expect(source).not.toContain('9.9.9-p6.unsupported');
  });

  it('restores and re-probes after errors, exits, and termination signals', () => {
    expect(source).toContain('write_version_list "$PREVIOUS_LIST"');
    expect(source).toContain('recreate_and_probe "$(env_value MINIPROGRAM_LEGACY_CLIENT_VERSION)"');
    expect(source).toContain('trap cleanup_on_exit EXIT');
    expect(source).toContain('trap rollback_on_error ERR');
    expect(source).toContain('trap rollback_on_signal HUP INT QUIT TERM');
  });
});
