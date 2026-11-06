import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('deployed artifact ownership boundary', () => {
  it('normalizes archive permissions on normal deployment and restoration', () => {
    const source = readFileSync('infra/scripts/ecs-update.sh', 'utf8');
    const extractions = source
      .split('\n')
      .filter((line) => /^\s*tar\b/u.test(line) && /\s-x(?:zf|f)\s/u.test(line));
    expect(extractions.length).toBeGreaterThanOrEqual(4);
    for (const extraction of extractions) {
      expect(extraction).toContain('--no-same-permissions');
      expect(extraction).toContain('--no-same-owner');
    }
    expect(source).toContain('umask 022');
    expect(source).toContain('seal_deployed_artifact_permissions');
  });

  it('checks code trees and parent directories before declaring production healthy', () => {
    const verify = readFileSync('infra/scripts/ecs-verify.sh', 'utf8');
    expect(verify.includes('verify_deployed_artifact_permissions ||')).toBe(true);
    expect(verify).toContain('-perm /022');
    expect(verify).toContain('runtime/api-flat/node_modules');
    expect(verify).toContain('infra/docker');
    expect(verify.includes('-type l')).toBe(true);
    expect(verify.includes('[ ! -L "$DEPLOY_DIR" ]')).toBe(true);
  });
});
