import fs from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

import { describe, expect, it } from 'vitest';

const poolScriptUrl = new URL('./manage-worktree-pool.ps1', import.meta.url);

describe('persistent worktree pool policy', () => {
  it('makes conversation-independent dependency reuse a Schedule hard gate', () => {
    const skill = fs.readFileSync(
      fileURLToPath(
        new URL('../../.agents/skills/schedule-project-guardrails/SKILL.md', import.meta.url),
      ),
      'utf8',
    );
    const reference = fs.readFileSync(
      fileURLToPath(
        new URL(
          '../../.agents/skills/schedule-project-guardrails/references/worktree-and-bootstrap.md',
          import.meta.url,
        ),
      ),
      'utf8',
    );

    expect(skill).toContain('A conversation boundary is never a dependency invalidation boundary.');
    expect(reference).toContain('不得因为新对话重装依赖');
    expect(reference).toContain('不得把 clean source 与 fresh `node_modules` 混为一谈');
    expect(reference).toContain('相同指纹必须复用依赖');
    expect(reference).toContain('worktree 池必须长期保留');
    expect(reference).toContain('安装依赖前必须输出具体失效原因');
    expect(reference).toContain('未发生指纹变化却执行 install，视为门禁失败');
  });

  it('uses explicit actions and a worktree-local atomic lease', () => {
    const source = fs.readFileSync(fileURLToPath(poolScriptUrl), 'utf8');

    expect(source).toContain(
      "[ValidateSet('Initialize', 'Acquire', 'Release', 'Status', 'ClearOutputs')]",
    );
    expect(source).toContain('[IO.FileMode]::CreateNew');
    expect(source).toContain('slot-lease-v1.lock');
    expect(source).toContain('pool-slot-v1.json');
  });

  it('keeps source cleanup allowlisted and never deletes dependencies or shared package outputs', () => {
    const source = fs.readFileSync(fileURLToPath(poolScriptUrl), 'utf8');

    expect(source).not.toMatch(/git\s+clean/iu);
    expect(source).toContain("'apps/*/dist'");
    expect(source).toContain("'infra/scripts/dist'");
    expect(source).toContain("'tests/*/dist'");
    expect(source).not.toContain("'packages/*/dist'");
    expect(source).not.toMatch(/Remove-Item[^\r\n]+node_modules/iu);
  });

  it('validates an external same-volume pool and refuses a linked node_modules root', () => {
    const source = fs.readFileSync(fileURLToPath(poolScriptUrl), 'utf8');

    expect(source).toContain('Assert-ExternalSameVolumePool');
    expect(source).toContain('Assert-StandaloneNodeModules');
    expect(source).toContain('ReparsePoint');
  });

  it('checks clean state and dependency compatibility before choosing a slot', () => {
    const source = fs.readFileSync(fileURLToPath(poolScriptUrl), 'utf8');

    expect(source).toContain('Test-CleanWorktree');
    expect(source).toContain('-CheckOnly');
    expect(source).toContain('Sort-Object');
    expect(source).toContain('compatible');
  });

  it('measures pnpm NDJSON plus Defender and never changes Defender policy', () => {
    const source = fs.readFileSync(
      fileURLToPath(new URL('./measure-pnpm-install.ps1', import.meta.url)),
      'utf8',
    );

    expect(source).toContain('Measure-Command');
    expect(source).toContain('--reporter=ndjson');
    expect(source).toContain("Name -eq 'MsMpEng'");
    expect(source).not.toMatch(/(?:Add|Set)-MpPreference/iu);
  });
});
