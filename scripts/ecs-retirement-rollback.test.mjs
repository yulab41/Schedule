import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const update = readFileSync(path.join(root, 'infra/scripts/ecs-update.sh'), 'utf8');
const rollback = readFileSync(path.join(root, 'infra/scripts/ecs-rollback.sh'), 'utf8');
const bash =
  process.platform === 'win32'
    ? ['C:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/usr/bin/bash.exe'].find(
        existsSync,
      )
    : 'bash';

function shellFunction(source, name) {
  const body = source.match(new RegExp(`^${name}\\(\\) \\{[\\s\\S]*?^\\}`, 'mu'))?.[0];
  expect(body, `actual shell function ${name}`).toBeDefined();
  return body;
}

function run(source, args = [], cwd = root) {
  expect(bash, 'existing Bash runtime is required; never install during a test').toBeDefined();
  return spawnSync(bash, ['--noprofile', '--norc', '-c', source, 'retirement-fixture', ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 15_000,
  });
}

describe('retirement application rollback (synthetic shell behavior, not a production restore drill)', () => {
  it('restores the S application archive after F failure without modifying schema54 or NULL data', () => {
    const fixtureRoot = path.join(root, 'runtime/codex/retirement-rollback-tests');
    mkdirSync(fixtureRoot, { recursive: true });
    const fixture = mkdtempSync(path.join(fixtureRoot, 'restore-'));
    for (const folder of ['backup', 's/apps/api/dist', 'deploy/apps/api/dist', 'database'])
      mkdirSync(path.join(fixture, folder), { recursive: true });
    const data = JSON.stringify({ schema: 54, groups: [{ id: 'synthetic-new', groupCode: null }] });
    writeFileSync(path.join(fixture, 'database/state.json'), data);
    writeFileSync(path.join(fixture, 's/current-release'), 'S-sanitized-compatible');
    writeFileSync(path.join(fixture, 's/apps/api/dist/release.txt'), 'S-null-safe-retired');
    writeFileSync(path.join(fixture, 'deploy/current-release'), 'F-interrupted');
    writeFileSync(path.join(fixture, 'deploy/apps/api/dist/release.txt'), 'F-interrupted');

    // Only extracted recovery functions execute. Every system/process operation and rm is mocked.
    // Real tar is limited to creating/extracting this test's own synthetic two-file archive.
    const script = `set -Eeuo pipefail
FIXTURE="$PWD"
DEPLOY_DIR="$FIXTURE/deploy"
BACKUP_DIR="$FIXTURE/backup"
DOMAIN=synthetic.invalid
NEXT_CURRENT_RELEASE=""
MIGRATION_LOG_PATH=""
MIGRATION_CONTAINER_NAME=synthetic-migration
DEPLOY_MUTATION_STARTED=true
command tar -czf "$BACKUP_DIR/current-files.tar.gz" -C "$FIXTURE/s" current-release apps/api/dist/release.txt
assert_release_path() {
  case "$1" in "$DEPLOY_DIR"/*) return 0 ;; *) return 91 ;; esac
}
rm() { printf 'rm-mocked\\n' >> "$FIXTURE/calls.log"; }
compose() { printf 'compose:%s\\n' "$*" >> "$FIXTURE/calls.log"; }
curl() { printf 'curl-mocked\\n' >> "$FIXTURE/calls.log"; }
docker() { printf 'docker:%s\\n' "$*" >> "$FIXTURE/calls.log"; }
restore_system_controls() { printf 'system-controls-mocked\\n' >> "$FIXTURE/calls.log"; }
tar() {
  [ "$#" = 4 ] && [ "$1" = -xzf ] &&
    [ "$2" = "$BACKUP_DIR/current-files.tar.gz" ] &&
    [ "$3" = -C ] && [ "$4" = "$DEPLOY_DIR" ] || return 92
  command tar "$@"
}
${shellFunction(update, 'restore_previous')}
${shellFunction(update, 'restore_deployment_state')}
restore_deployment_state
[ "$DEPLOY_MUTATION_STARTED" = false ]
`;
    const result = run(script, [], fixture);
    expect(result.status, result.stderr).toBe(0);
    expect(readFileSync(path.join(fixture, 'deploy/current-release'), 'utf8')).toBe(
      'S-sanitized-compatible',
    );
    expect(readFileSync(path.join(fixture, 'deploy/apps/api/dist/release.txt'), 'utf8')).toBe(
      'S-null-safe-retired',
    );
    expect(readFileSync(path.join(fixture, 'database/state.json'), 'utf8')).toBe(data);
    const calls = readFileSync(path.join(fixture, 'calls.log'), 'utf8');
    expect(calls).toContain('compose:up -d --force-recreate api web');
    expect(calls).toContain('docker:rm -f synthetic-migration');
    expect(calls).not.toMatch(/mysql|migrate|restore.*database/u);
  });

  it.each([
    { min: '52', max: '53', allowed: false },
    { min: '53', max: '54', allowed: true },
    { min: '54', max: '54', allowed: true },
    { min: '55', max: '55', allowed: false },
  ])('schema54 compatibility gate: $min..$max -> $allowed', ({ min, max, allowed }) => {
    const start = rollback.indexOf('if [[ ! "$CURRENT_DATABASE_SCHEMA" =~');
    const end = rollback.indexOf('\nfi', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const actualGate = rollback.slice(start, end + 3);
    const result = run(
      `set -Eeuo pipefail
CURRENT_DATABASE_SCHEMA=54
TARGET_DATABASE_SCHEMA_MIN="$1"
TARGET_DATABASE_SCHEMA_MAX="$2"
fail() { printf '%s\\n' "$*" >&2; return 1; }
${actualGate}
printf 'accepted\\n'
`,
      [min, max],
    );
    expect(result.status === 0, result.stderr).toBe(allowed);
    if (allowed) expect(result.stdout.trim()).toBe('accepted');
    else expect(result.stderr).toContain('schema 54');
  });
});
