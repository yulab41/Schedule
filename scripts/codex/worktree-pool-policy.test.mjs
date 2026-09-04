import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('pool policy is exclusive, persistent, and never creates a cold worktree', () => {
  const pool = fs.readFileSync(path.join(root, 'scripts/codex/manage-worktree-pool.ps1'), 'utf8');
  assert.match(pool, /CreateNew/iu);
  assert.match(pool, /slot-lease-v1\.lock/iu);
  assert.match(pool, /sessionId/iu);
  assert.match(pool, /taskId/iu);
  assert.match(pool, /lastHeartbeat/iu);
  assert.match(pool, /dependencyFingerprint/iu);
  assert.match(pool, /bootstrapProfile/iu);
  assert.match(pool, /lease\.head/iu);
  assert.match(pool, /lease\.branch/iu);
  assert.match(pool, /Get-ChildProcessEvidence/iu);
  assert.match(pool, /process-parent-tree/iu);
  assert.doesNotMatch(pool, /git\s+-C[^\r\n]+worktree\s+add/iu);
  assert.doesNotMatch(pool, /git\s+clean/iu);
  assert.doesNotMatch(pool, /node_modules[^\r\n]*(?:Remove-Item|rm\s+-rf)/iu);
});

test('setup wrappers default to ReuseOnly and cannot request maintenance implicitly', () => {
  const deps = fs.readFileSync(path.join(root, 'scripts/codex/ensure-worktree-deps.ps1'), 'utf8');
  const bootstrap = fs.readFileSync(path.join(root, 'scripts/codex/ensure-workspace-bootstrap.ps1'), 'utf8');
  const core = fs.readFileSync(path.join(root, 'scripts/codex/worktree-deps-core.mjs'), 'utf8');
  assert.match(deps, /\$Mode\s*=\s*['"]ReuseOnly['"]/u);
  assert.match(bootstrap, /\$Mode\s*=\s*['"]ReuseOnly['"]/u);
  assert.match(core, /if\s*\(mode\s*===\s*['"]ReuseOnly['"]\)/u);
  assert.match(core, /validateMaintenanceAuthorization/iu);
});

test('release preparation requires a pre-existing reusable environment', () => {
  const release = fs.readFileSync(path.join(root, 'scripts/prepare-release-worktree.mjs'), 'utf8');
  assert.match(release, /mode:\s*['"]ReuseOnly['"]/u);
  assert.match(release, /TASK_STATUS=BLOCKED_NO_REUSABLE_DEPENDENCY_ENV/u);
  assert.doesNotMatch(release, /runPnpmInstall/iu);
});

test('root route and skill markers are unique and the required split references exist', () => {
  const agents = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  assert.equal((agents.match(/schedule-project-runtime-route:start/g) ?? []).length, 1);
  assert.equal((agents.match(/schedule-project-runtime-route:end/g) ?? []).length, 1);
  for (const relativePath of [
    '.agents/skills/schedule-project-guardrails/SKILL.md',
    '.agents/skills/schedule-project-guardrails/references/dependency-lifecycle.md',
    '.agents/skills/schedule-project-guardrails/references/multi-parallel-workflow.md',
  ]) assert.equal(fs.existsSync(path.join(root, relativePath)), true, relativePath);
});
