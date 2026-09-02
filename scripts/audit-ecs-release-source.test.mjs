import { describe, expect, it } from 'vitest';

import { buildEcsSourceDryRunManifest } from './audit-ecs-release-source.mjs';

const stage1Commit = '5dcb2b5ae7034aea1ad34033a38a58c9683f4b9a';
const stage2Reference = '09156b67fc7a7687ae763efb4ef0736256c472ac';

describe('ECS source-only release dry-run manifest', () => {
  it('proves stage 1 cannot package or execute migration 0053', () => {
    const manifest = buildEcsSourceDryRunManifest(stage1Commit);

    expect(manifest).toMatchObject({
      buildArtifactsGenerated: false,
      deployable: false,
      releaseId: stage1Commit,
      productionDeploymentExecuted: false,
    });
    expect(manifest.migrations.highestTag).toBe('0052_user_profile_avatars');
    expect(manifest.migrations.includes0053).toBe(false);
    expect(manifest.migrations.updaterCanExecute0053).toBe(false);
    expect(manifest.commitDeltaPaths).not.toContain(
      'migrations/0053_directory_candidate_covering_index.sql',
    );
  });

  it('keeps benchmark/runtime evidence outside production archive paths', () => {
    const manifest = buildEcsSourceDryRunManifest(stage2Reference);

    expect(manifest.migrations.includes0053).toBe(true);
    expect(manifest.migrations.updaterCanExecute0053).toBe(true);
    expect(manifest.excludedEvidencePaths).toContain('scripts/directory-query-readiness/');
    expect(manifest.excludedEvidencePaths).toContain('runtime/');
    expect(manifest.productionArchivePaths).not.toContain('scripts/directory-query-readiness');
    expect(manifest.productionArchivePaths).not.toContain('runtime');
    expect(manifest.productionSourceTreeSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(buildEcsSourceDryRunManifest(stage2Reference)).toEqual(manifest);
  });
});
