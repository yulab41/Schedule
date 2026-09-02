import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

function source(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('project-local generated artifacts', () => {
  it('keeps release packaging scratch data under runtime/tmp', () => {
    const value = source('./package-ecs-release.mjs');

    expect(value).not.toContain("from 'node:os'");
    expect(value).not.toContain('os.tmpdir()');
    expect(value).toContain("path.join(ROOT, 'runtime', 'tmp')");
  });

  it('keeps only the latest browser smoke evidence under runtime/smoke', () => {
    const value = source('./smoke-browser.mjs');
    const gitignore = source('../.gitignore');

    expect(value).not.toContain("from 'node:os'");
    expect(value).not.toContain('os.tmpdir()');
    expect(value).toContain("path.join(ROOT, 'runtime', 'smoke', 'latest')");
    expect(value).toContain('assertRuntimeArtifactPath');
    expect(gitignore).toMatch(/^\/runtime\/smoke\/$/m);
  });

  it('defaults the reusable release worktree to runtime/release-worktree', () => {
    const value = source('./prepare-release-worktree.mjs');

    expect(value).toContain("path.join(ROOT, 'runtime', 'release-worktree')");
    expect(value).not.toContain(
      'path.join(path.dirname(ROOT), `${path.basename(ROOT)}-release-worktree`)',
    );
  });
});
