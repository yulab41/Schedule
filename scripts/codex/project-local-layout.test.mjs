import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const toolchainFiles = [
  '.agents/skills/schedule-project-guardrails/SKILL.md',
  '.agents/skills/schedule-project-guardrails/references/dependency-lifecycle.md',
  '.agents/skills/schedule-project-guardrails/references/multi-parallel-workflow.md',
  '.agents/skills/schedule-project-guardrails/references/worktree-and-bootstrap.md',
  '.codex/config.toml',
  '.codex/rules/schedule-dependency-mutation.rules',
  '.codex/setup.ps1',
  '.pnpmfile.cjs',
  'scripts/codex/ensure-worktree-deps.ps1',
  'scripts/codex/ensure-workspace-bootstrap.ps1',
  'scripts/codex/dependency-maintenance.ps1',
  'scripts/codex/install-tripwire.cjs',
  'scripts/codex/manage-worktree-pool.ps1',
  'scripts/codex/provision-warm-pool.ps1',
  'scripts/codex/register-legacy-external-worktrees.ps1',
  'scripts/codex/schedule-project-setup.ps1',
  'scripts/codex/worktree-deps-core.mjs',
  'scripts/codex/workspace-bootstrap-core.mjs',
];

test('uses exact ignored project-local runtime paths without external or user-level Schedule paths', () => {
  const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  for (const entry of ['/runtime/codex/', '/runtime/wt/', '/runtime/pnpm-store/']) {
    assert.match(ignore, new RegExp(`^${entry.replaceAll('/', '\\/')}$`, 'mu'), entry);
  }
  assert.doesNotMatch(ignore, /^\/runtime\/$/mu);

  const externalPoolToken = ['Schedule', 'WT'].join('');
  const globalHomeToken = ['$', 'CODEX', '_HOME'].join('');
  for (const relativePath of toolchainFiles) {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    assert.equal(source.includes(externalPoolToken), false, relativePath);
    assert.equal(source.includes(globalHomeToken), false, relativePath);
    assert.equal(/(?:^|[A-Za-z]:)[\\/]Users[\\/]/u.test(source), false, relativePath);
  }
});

test('project Codex files are local, no-hook, no-install setup surfaces', () => {
  const config = fs.readFileSync(path.join(root, '.codex', 'config.toml'), 'utf8');
  assert.equal(config.split(/\r?\n/u).every((line) => line.trim() === '' || line.trim().startsWith('#')), true);
  assert.equal(fs.existsSync(path.join(root, '.codex', 'hooks.json')), false);
  assert.equal(fs.existsSync(path.join(root, '.codex', 'hooks')), false);
  const setup = fs.readFileSync(path.join(root, '.codex', 'setup.ps1'), 'utf8');
  assert.match(setup, /schedule-project-setup\.ps1/iu);
  assert.doesNotMatch(setup, /pnpm\s+(?:install|i)|npm\s+(?:install|i|ci)|yarn\s+install/iu);
  const rules = fs.readFileSync(path.join(root, '.codex', 'rules', 'schedule-dependency-mutation.rules'), 'utf8');
  assert.match(rules, /decision\s*=\s*"forbidden"/iu);
  assert.match(rules, /match\s*=/iu);
  assert.match(rules, /not_match\s*=/iu);
});

test('state and pool implementations never fall back to Git admin state or cold task creation', () => {
  const dependency = fs.readFileSync(path.join(root, 'scripts/codex/worktree-deps-core.mjs'), 'utf8');
  const bootstrap = fs.readFileSync(path.join(root, 'scripts/codex/workspace-bootstrap-core.mjs'), 'utf8');
  const pool = fs.readFileSync(path.join(root, 'scripts/codex/manage-worktree-pool.ps1'), 'utf8');
  const legacyAdminState = ['schedule', 'worktree', 'state'].join('-');
  assert.doesNotMatch(dependency, new RegExp(legacyAdminState, 'iu'));
  assert.doesNotMatch(bootstrap, new RegExp(legacyAdminState, 'iu'));
  assert.match(dependency, /fingerprints/iu);
  assert.match(bootstrap, /resolveProjectLocalState/iu);
  assert.match(pool, /runtime[\\/]wt/iu);
  assert.match(pool, /runtime[\\/]codex/iu);
  assert.doesNotMatch(pool, /worktree\s+add/iu);
  assert.doesNotMatch(pool, /git\s+clean/iu);
  assert.match(pool, /NESTED_WORKTREE_CREATION=false/iu);
  const tripwire = fs.readFileSync(path.join(root, 'scripts/codex/install-tripwire.cjs'), 'utf8');
  assert.match(tripwire, /before dependency resolution\/import\/link/iu);
  assert.doesNotMatch(tripwire, /dangerously-bypass-hook-trust/iu);
});
