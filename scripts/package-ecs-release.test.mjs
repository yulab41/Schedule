import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageSource = readFileSync(
  fileURLToPath(new URL('./package-ecs-release.mjs', import.meta.url)),
  'utf8',
);
const updateSource = readFileSync(
  fileURLToPath(new URL('../infra/scripts/ecs-update.sh', import.meta.url)),
  'utf8',
);
const verifySource = readFileSync(
  fileURLToPath(new URL('../infra/scripts/ecs-verify.sh', import.meta.url)),
  'utf8',
);
const rollbackSource = readFileSync(
  fileURLToPath(new URL('../infra/scripts/ecs-rollback.sh', import.meta.url)),
  'utf8',
);
const capabilitySwitchSource = readFileSync(
  fileURLToPath(new URL('../infra/scripts/client-capability-switch.sh', import.meta.url)),
  'utf8',
);
const attributesSource = readFileSync(
  fileURLToPath(new URL('../.gitattributes', import.meta.url)),
  'utf8',
);

describe('ECS directory import runtime packaging', () => {
  it('ships compiled infra scripts and their complete production dependency closure', () => {
    expect(packageSource).toContain("'infra/scripts/dist'");
    expect(packageSource).toContain("'@schedule/holiday-import-script'");
    expect(packageSource).toContain('infraScriptsDistTreeSha256');
    expect(updateSource.match(/infra\/scripts\/dist/gu)).toHaveLength(4);
  });

  it('verifies the directory import artifact and declared database compatibility', () => {
    expect(verifySource).toContain('infraScriptsDistTreeSha256');
    expect(verifySource).toContain('$DEPLOY_DIR/infra/scripts/dist');
    expect(verifySource).toContain('databaseSchemaMin');
    expect(verifySource).toContain('databaseSchemaMax');
  });

  it('stops the old API write path before migrations and only restarts it afterward', () => {
    const stopIndex = updateSource.indexOf('compose stop api');
    const migrateIndex = updateSource.indexOf('compose run --rm api node apps/api/dist/migrate.js');
    const restartIndex = updateSource.indexOf(
      'compose up -d --force-recreate api web',
      migrateIndex,
    );

    expect(stopIndex).toBeGreaterThan(-1);
    expect(stopIndex).toBeLessThan(migrateIndex);
    expect(migrateIndex).toBeLessThan(restartIndex);
  });

  it('hashes release trees in the same sibling-sorted recursive order as the packager', () => {
    expect(packageSource).toContain('for (const child of fs.readdirSync(currentPath).sort())');
    expect(verifySource).toContain('tree_sha256_entries()');
    expect(verifySource).toContain(`find "$current_root" -mindepth 1 -maxdepth 1 -printf '%f\\0'`);
    expect(verifySource).not.toContain(`find "$root" -type f -printf '%P\\0' | LC_ALL=C sort -z`);
  });

  it('ships and hashes the trusted deploy, verify, rollback and capability controls', () => {
    for (const scriptPath of [
      'infra/scripts/ecs-update.sh',
      'infra/scripts/ecs-verify.sh',
      'infra/scripts/ecs-rollback.sh',
      'infra/scripts/client-capability-switch.sh',
      'infra/scripts/schedule-backup.sh',
    ]) {
      expect(packageSource).toContain(`'${scriptPath}'`);
    }

    for (const hashName of [
      'ecsUpdateSha256',
      'ecsVerifySha256',
      'ecsRollbackSha256',
      'clientCapabilitySwitchSha256',
      'backupSchedulerSha256',
    ]) {
      expect(packageSource).toContain(hashName);
      expect(updateSource).toContain(hashName);
      expect(verifySource).toContain(hashName);
    }

    expect(rollbackSource).toContain('/usr/local/lib/schedule/ecs-update.sh');
    expect(capabilitySwitchSource).toContain('DEPLOY_DIR="/opt/schedule"');
    expect(capabilitySwitchSource).toContain('ENV_FILE="$DEPLOY_DIR/.env.production"');
  });

  it('refuses mislabeled or non-portable release artifacts before packaging', () => {
    expect(attributesSource).toContain('*.sh text eol=lf');
    expect(packageSource).toContain('ECS_RELEASE_EXPECTED_COMMIT');
    expect(packageSource).toContain("['diff', '--quiet', '--exit-code']");
    expect(packageSource).toContain("['diff', '--cached', '--quiet', '--exit-code']");
    expect(packageSource).toContain("['ls-files', '--others', '--exclude-standard']");
    expect(packageSource).toContain('assertPortableShellScripts');
    expect(packageSource).toContain('assertPortableShellSyntax');
    expect(packageSource).toContain("RELEASE_FEATURE_LEVEL = 'p6-client-capabilities-v1'");
    expect(packageSource).toContain('releaseFeatureLevel: RELEASE_FEATURE_LEVEL');
    expect(packageSource).toContain("databaseSchemaMin: '49'");
    expect(packageSource).toContain("databaseSchemaMax: '50'");
    expect(packageSource).toContain('ECS_ROLLBACK_CANDIDATE');
    expect(packageSource).toContain('rollbackCandidate: rollbackCandidate()');
    expect(packageSource.indexOf("'build'")).toBeLessThan(
      packageSource.indexOf("run(tarPath(), ['-czf'"),
    );
  });
});
