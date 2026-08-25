import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P10 profile RC plan', () => {
  it('locks the candidate and the manual stop condition', () => {
    const plan = read('docs/runbooks/p10-profile-rc.md');
    expect(plan).toContain('0.1.0-p9.20260826.15');
    expect(plan).toContain('P10 个人中心 RC 通过');
    expect(plan).toContain('不打开生产 `organization`');
    expect(plan).toContain('不提交审核或正式发布');
  });

  it('covers both authentication methods, safe exits and size states', () => {
    const plan = read('docs/runbooks/p10-profile-rc.md');
    for (const phrase of [
      '微信快捷登录',
      '账号密码登录',
      '账号密码登录无需解除微信绑定',
      '切换登录方式',
      '退出当前会话',
      '尚未登录',
      '大字号',
    ]) {
      expect(plan).toContain(phrase);
    }
  });
});
