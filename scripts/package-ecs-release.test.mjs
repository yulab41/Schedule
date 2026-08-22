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

describe('ECS directory import runtime packaging', () => {
  it('ships compiled infra scripts and their complete production dependency closure', () => {
    expect(packageSource).toContain("'infra/scripts/dist'");
    expect(packageSource).toContain("'@schedule/holiday-import-script'");
    expect(packageSource).toContain('infraScriptsDistTreeSha256');
    expect(updateSource.match(/infra\/scripts\/dist/gu)).toHaveLength(4);
  });

  it('verifies the directory import artifact and current migration count', () => {
    expect(verifySource).toContain('infraScriptsDistTreeSha256');
    expect(verifySource).toContain('$DEPLOY_DIR/infra/scripts/dist');
    expect(verifySource).toContain("grep -qx '44'");
  });

  it('hashes release trees in the same sibling-sorted recursive order as the packager', () => {
    expect(packageSource).toContain('for (const child of fs.readdirSync(currentPath).sort())');
    expect(verifySource).toContain('tree_sha256_entries()');
    expect(verifySource).toContain(`find "$current_root" -mindepth 1 -maxdepth 1 -printf '%f\\0'`);
    expect(verifySource).not.toContain(`find "$root" -type f -printf '%P\\0' | LC_ALL=C sort -z`);
  });
});
