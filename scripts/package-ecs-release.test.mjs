import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
    expect(verifySource).toContain("grep -qx '38'");
  });
});
