import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

async function readScript(name: string): Promise<string> {
  return readFile(fileURLToPath(new URL(`./${name}`, import.meta.url)), 'utf8');
}

describe('production Mini Program capability control', () => {
  it('uses the same strict semver-like validator in switch, deploy, and verify controls', async () => {
    const sources = await Promise.all(
      ['client-capability-switch.sh', 'ecs-update.sh', 'ecs-verify.sh'].map(readScript),
    );
    const validators = sources.map((source) =>
      source.slice(
        source.indexOf('is_valid_client_version()'),
        source.indexOf('validate_client_version_configuration()'),
      ),
    );

    expect(validators[0]).not.toBe('');
    expect(validators[1]).toBe(validators[0]);
    expect(validators[2]).toBe(validators[0]);
    expect(validators[0]).toContain('declare -A seen_versions');
    expect(validators[0]).toContain('\\+');
    expect(validators[0]).toContain('${#version}');
  });

  it('only accepts the seven frozen capability names and strict boolean values', async () => {
    const source = await readScript('client-capability-switch.sh');

    expect(source).toContain('global|core|workflows|organization|insights|externalMessages|guest');
    expect(source).toContain('true|false');
    for (const key of [
      'MINIPROGRAM_CAPABILITY_GLOBAL_ENABLED',
      'MINIPROGRAM_CAPABILITY_CORE_ENABLED',
      'MINIPROGRAM_CAPABILITY_WORKFLOWS_ENABLED',
      'MINIPROGRAM_CAPABILITY_ORGANIZATION_ENABLED',
      'MINIPROGRAM_CAPABILITY_INSIGHTS_ENABLED',
      'MINIPROGRAM_CAPABILITY_EXTERNAL_MESSAGES_ENABLED',
      'MINIPROGRAM_CAPABILITY_GUEST_ENABLED',
    ]) {
      expect(source).toContain(key);
    }
  });

  it('edits the production environment atomically under a lock and never sources secrets', async () => {
    const source = await readScript('client-capability-switch.sh');

    expect(source).toContain('flock -n 9');
    expect(source).toContain('mktemp "$DEPLOY_DIR/.env.production.capability.XXXXXX"');
    expect(source).toContain('chmod --reference="$ENV_FILE"');
    expect(source).toContain('chown --reference="$ENV_FILE"');
    expect(source).toContain('mv -f -- "$NEXT_ENV" "$ENV_FILE"');
    expect(source).not.toMatch(/(?:^|\n)\s*(?:source|\.)\s+[^\n]*\.env\.production/u);
    expect(source).toContain('PREVIOUS_VALUE=');
    expect(source).not.toContain('.env.production.capability.previous.');
    expect(source).not.toContain('PREVIOUS_ENV');
    expect(source).toContain('stat -c');
  });

  it('serializes capability changes with deployments and makes restoration failures explicit', async () => {
    const source = await readScript('client-capability-switch.sh');

    const releaseLockIndex = source.indexOf('/var/lock/schedule-release.lock');
    const capabilityLockIndex = source.indexOf('/var/lock/schedule-client-capability.lock');
    const mutationIndex = source.indexOf('write_environment_value "$DESIRED_VALUE"');
    expect(releaseLockIndex).toBeGreaterThan(-1);
    expect(capabilityLockIndex).toBeGreaterThan(releaseLockIndex);
    expect(mutationIndex).toBeGreaterThan(capabilityLockIndex);
    expect(source).toContain('write_environment_value "$PREVIOUS_VALUE"');
    expect(source).toContain('trap rollback_on_signal HUP INT TERM');
    expect(source).toContain('cleanup_on_exit');
    expect(source).toContain('自动恢复失败');
  });

  it('recreates only the API and restores the prior environment if health or policy probing fails', async () => {
    const source = await readScript('client-capability-switch.sh');

    expect(source).toContain('up -d --force-recreate api');
    expect(source).not.toContain('up -d --force-recreate api web');
    expect(source).toContain('restore_previous_environment');
    expect(source).toContain('/api/client-capabilities');
    expect(source).toContain('--data-urlencode "version=$version"');
    expect(source).toContain('effective capability response mismatch');
  });
});

describe('production application rollback', () => {
  it('confines an exact commit target to the immutable release directory', async () => {
    const source = await readScript('ecs-rollback.sh');

    expect(source).toContain('^[0-9a-f]{40}$');
    expect(source).toContain('readlink -f --');
    expect(source).toContain('"$DEPLOY_DIR/releases/$TARGET_RELEASE"');
    expect(source).toContain('flock -n 9');
    expect(source).toContain('ALLOWED_ROLLBACK_CANDIDATE');
    expect(source).toContain('TARGET_RELEASE" != "$ALLOWED_ROLLBACK_CANDIDATE');
  });

  it('backs up the database but never performs a database downgrade or restore', async () => {
    const source = await readScript('ecs-rollback.sh');

    const backupIndex = source.indexOf('schedule-backup.sh');
    const updateIndex = source.indexOf('bash "$UPDATE_SCRIPT"');
    expect(backupIndex).toBeGreaterThan(-1);
    expect(updateIndex).toBeGreaterThan(backupIndex);
    expect(source).not.toContain('restore-backup');
    expect(source).not.toContain('DROP DATABASE');
    expect(source).toContain('TARGET_DATABASE_SCHEMA_MIN');
    expect(source).toContain('TARGET_DATABASE_SCHEMA_MAX');
    expect(source).toContain('CURRENT_DATABASE_SCHEMA');
  });

  it('copies retained artifacts to a temporary directory before update and verifies afterward', async () => {
    const source = await readScript('ecs-rollback.sh');

    const temporaryIndex = source.indexOf('mktemp -d "$DEPLOY_DIR/.rollback.XXXXXX"');
    const copyIndex = source.indexOf('schedule-dist.tar.gz" "$ROLLBACK_TMP/');
    const rollbackStepIndex = source.indexOf('echo "[rollback] 2/3');
    const updateIndex = source.indexOf('bash "$UPDATE_SCRIPT"', rollbackStepIndex);
    const verifyIndex = source.indexOf('bash "$VERIFY_SCRIPT"', updateIndex);
    expect(temporaryIndex).toBeGreaterThan(-1);
    expect(copyIndex).toBeGreaterThan(temporaryIndex);
    expect(updateIndex).toBeGreaterThan(copyIndex);
    expect(verifyIndex).toBeGreaterThan(updateIndex);
  });

  it('restores the original application automatically if post-rollback verification fails', async () => {
    const source = await readScript('ecs-rollback.sh');

    expect(source).toContain('ORIGINAL_RELEASE');
    expect(source).toContain('ROLLBACK_APPLIED="true"');
    expect(source).toContain('restore_original_release');
    expect(source).toContain('rollback_on_error');
  });

  it('hands its already-held release lock to the trusted updater', async () => {
    const source = await readScript('ecs-rollback.sh');

    expect(source).toContain('SCHEDULE_PRESERVE_CONTROL_PLANE=true');
    expect(source).toContain('SCHEDULE_RELEASE_LOCK_FD=9');
    expect(source).toContain('bash "$UPDATE_SCRIPT"');
  });
});

describe('release control installation and backward compatibility', () => {
  it('installs root-owned trusted controls while allowing pre-P6 retained releases', async () => {
    const updateSource = await readScript('ecs-update.sh');
    const verifySource = await readScript('ecs-verify.sh');

    expect(updateSource).toContain('archive_has_path');
    expect(updateSource).toContain('/usr/local/lib/schedule/ecs-update.sh');
    expect(updateSource).toContain('/usr/local/lib/schedule/ecs-verify.sh');
    expect(updateSource).toContain('/usr/local/bin/schedule-ecs-rollback');
    expect(updateSource).toContain('/usr/local/bin/schedule-client-capability');
    expect(verifySource).toContain('if [ "$RELEASE_FEATURE_LEVEL" = "$P6_RELEASE_FEATURE_LEVEL" ]');
    expect(verifySource).toContain('pre-P6 release: capability endpoint probe skipped');
  });

  it('requires root, canonicalizes inputs, and serializes deploys under the release lock', async () => {
    const updateSource = await readScript('ecs-update.sh');

    expect(updateSource).toContain('if [ "$(id -u)" -ne 0 ]');
    expect(updateSource).toContain('readlink -f -- "$DIST_TAR"');
    expect(updateSource).toContain('/var/lock/schedule-release.lock');
    expect(updateSource).toContain('SCHEDULE_RELEASE_LOCK_FD');
    expect(updateSource).toContain('CANONICAL_RELEASE_LOCK_PATH');
    expect(updateSource).toContain('readlink -f -- "$RELEASE_LOCK_PATH"');
  });

  it('retains artifacts without failing when an operator supplies the retained path itself', async () => {
    const updateSource = await readScript('ecs-update.sh');

    expect(updateSource).toContain('copy_retained_artifact()');
    expect(updateSource).toContain('if [ "$source_path" = "$destination_path" ]');
    expect(updateSource).not.toContain('cp "$DIST_TAR" "$RELEASE_DIR/schedule-dist.tar.gz"');
  });

  it('never downgrades the trusted control plane during rollback and restores partial installs', async () => {
    const updateSource = await readScript('ecs-update.sh');
    const verifySource = await readScript('ecs-verify.sh');

    expect(updateSource).toContain('SCHEDULE_PRESERVE_CONTROL_PLANE');
    expect(updateSource).toContain('preserving the installed trusted control plane');
    expect(updateSource).toContain('system-controls.tar.gz');
    expect(updateSource).toContain('restore_system_controls');
    expect(updateSource).toContain('control-plane-manifest.json');
    expect(verifySource).toContain('control-plane-manifest.json');
    expect(verifySource).toContain('releaseFeatureLevel');
    expect(updateSource).toContain('trap rollback_on_signal HUP INT TERM');
    expect(updateSource).toContain('cleanup_on_exit');
  });
});
