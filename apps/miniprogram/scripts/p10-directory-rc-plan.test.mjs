import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('P10 directory RC plan', () => {
  it('pins the candidate version, route, capabilities and manual stop condition', () => {
    const plan = readFileSync(path.join(appRoot, 'docs/runbooks/p10-directory-rc.md'), 'utf8');
    expect(plan).toContain('0.1.0-p9.20260827.28');
    expect(plan).toContain('organization=false');
    expect(plan).toContain('P10 通讯录实体 Android RC 验收');
    expect(plan).toContain('工作台 More');
    expect(plan).toContain('P10 通讯录 RC 通过');
  });

  it('covers both modes, seven filters, dialing and all state/size combinations', () => {
    const plan = readFileSync(path.join(appRoot, 'docs/runbooks/p10-directory-rc.md'), 'utf8');
    for (const text of [
      '院区',
      '片区',
      '楼宇',
      '楼层',
      '科室',
      '单元',
      '组织根',
      '一级组织',
      '五级组织',
      '加载更多',
      '完整手机/座机号码',
    ]) {
      expect(plan).toContain(text);
    }
    for (const state of [
      'ready/结果卡',
      'loading facets/list',
      'empty',
      'error/retry',
      'organization disabled',
    ]) {
      expect(plan).toContain(state);
    }
    expect(plan).toContain('| 320 |');
    expect(plan).toContain('| 大字号 |');
  });
});
