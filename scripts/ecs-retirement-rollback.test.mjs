import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const update = readFileSync(path.join(root, 'infra/scripts/ecs-update.sh'), 'utf8');
const rollback = readFileSync(path.join(root, 'infra/scripts/ecs-rollback.sh'), 'utf8');
const verify = readFileSync(path.join(root, 'infra/scripts/ecs-verify.sh'), 'utf8');
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
  it.each([
    [51, 54, true],
    [52, 55, true],
    [55, 55, true],
    [56, 55, true],
    [56, 53, true],
    [56, 54, false],
    [55, 53, false],
    [57, 53, true],
    [57, 54, true],
    [57, 55, false],
    [57, 52, false],
    [57, 56, false],
  ])('validates backup table count for schema %s / %s', (schema, tables, allowed) => {
    const result = run(
      `${shellFunction(verify, 'is_valid_backup_table_count')}\nif is_valid_backup_table_count "$1" "$2"; then printf allowed; else printf denied; fi`,
      [String(schema), String(tables)],
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toBe(allowed ? 'allowed' : 'denied');
  });
  it('rejects a retry after partial migration before overwriting the original recovery archive', () => {
    const parent = path.join(root, 'runtime/codex/retirement-rollback-tests');
    mkdirSync(parent, { recursive: true });
    const f = mkdtempSync(path.join(parent, 'retry-'));
    writeFileSync(path.join(f, 'current-release'), 'a'.repeat(40));
    writeFileSync(
      path.join(f, 'deploy-manifest.json'),
      JSON.stringify({ releaseId: 'b'.repeat(40), databaseSchemaMax: '56' }),
    );
    writeFileSync(path.join(f, 'original-backup'), 'original recovery materials');
    const result = run(
      `set -Eeuo pipefail
DEPLOY_DIR="$PWD"
fail(){ printf '%s\\n' "$*" >&2; return 1; }
${shellFunction(update, 'validate_previous_release_identity')}
validate_previous_release_identity
printf overwritten > original-backup
`,
      [],
      f,
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('未完成迁移');
    expect(readFileSync(path.join(f, 'original-backup'), 'utf8')).toBe(
      'original recovery materials',
    );
    expect(update.indexOf('\nvalidate_previous_release_identity\n')).toBeLessThan(
      update.indexOf('mkdir -p "$BACKUP_DIR"'),
    );
    expect(update.indexOf('MIGRATION_STARTED="true"')).toBeLessThan(
      update.indexOf('\nrun_database_migrations\n'),
    );
  });
  it.each([
    ['false', '54', '56', true],
    ['true', '54', '56', false],
    ['true', '56', '56', true],
    ['true', '', '56', false],
  ])(
    'migration entered=%s previous max=%s target=%s restoration=%s',
    (entered, previous, target, allowed) => {
      const result = run(
        `set -Eeuo pipefail
MIGRATION_STARTED="$1"
PREVIOUS_DATABASE_SCHEMA_MAX="$2"
DATABASE_SCHEMA_MAX="$3"
${shellFunction(update, 'can_restore_previous_application')}
if can_restore_previous_application; then printf allowed; else printf blocked; fi
`,
        [entered, previous, target],
      );
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toBe(allowed ? 'allowed' : 'blocked');
    },
  );

  it.each(['ERR', 'TERM', 'EXIT'])(
    'keeps old API stopped after partial DDL on %s, even before journal count advances',
    (failure) => {
      const result = run(
        `set -Eeuo pipefail
MIGRATION_STARTED=true
PREVIOUS_DATABASE_SCHEMA_MAX=54
DATABASE_SCHEMA_MAX=56
CURRENT_DATABASE_SCHEMA=54
DEPLOY_MUTATION_STARTED=true
NEXT_CURRENT_RELEASE=""
MIGRATION_LOG_PATH=""
MIGRATION_CONTAINER_NAME=synthetic-migrate
DOMAIN=synthetic.invalid
curl() { return 0; }
exec 3>&1
docker() { printf 'migration-stopped\\n' >&3; }
compose() { printf 'compose:%s\\n' "$*"; }
restore_previous() { printf 'UNSAFE-RESTORE\\n'; }
restore_system_controls() { printf 'UNSAFE-CONTROLS\\n'; }
${update.match(/^can_restore_previous_application\(\) \{[\s\S]*?^\}/mu)?.[0] ?? ''}
${shellFunction(update, 'restore_deployment_state')}
${shellFunction(update, 'rollback_on_error')}
${shellFunction(update, 'rollback_on_signal')}
${shellFunction(update, 'cleanup_on_exit')}
trap rollback_on_error ERR
trap rollback_on_signal TERM
trap cleanup_on_exit EXIT
case "$1" in ERR) false ;; TERM) kill -TERM "$BASHPID" ;; EXIT) exit 23 ;; esac
`,
        [failure],
      );
      expect(result.status).not.toBe(0);
      expect(result.stdout).toContain('compose:stop api');
      expect(result.stdout).not.toMatch(/UNSAFE|compose:up/u);
      expect(result.stdout.indexOf('migration-stopped')).toBeGreaterThanOrEqual(0);
      expect(result.stdout.indexOf('migration-stopped')).toBeLessThan(
        result.stdout.indexOf('compose:stop api'),
      );
      expect(result.stderr).toContain('不兼容');
    },
  );
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
${shellFunction(update, 'can_restore_previous_application')}
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
