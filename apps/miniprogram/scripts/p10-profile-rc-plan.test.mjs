import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P10 profile RC plan', () => {
  it('requires current release identity and preserves the device-review stop condition', () => {
    const plan = read('docs/runbooks/p10-profile-rc.md');
    expect(plan).toContain('UX-CLEANUP-10 Q1/Q5');
    expect(plan).toContain('总控发布记录');
    expect(plan).toContain('源码与 manifest');
    expect(plan).toContain('待用户复核');
    expect(plan).not.toContain('0.1.0-p9.20260828.64');
    expect(plan).not.toContain('生产 `organization=true`');
    expect(plan).toContain('不提审、不正式发布');
    expect(plan).toContain('两次都不得白屏');
  });

  it('covers both authentication methods, safe exits and size states', () => {
    const plan = read('docs/runbooks/p10-profile-rc.md');
    for (const phrase of [
      '微信快捷登录',
      '账号密码登录',
      '微信小程序身份',
      '姓名首字',
      '解除绑定',
      '重试',
      '值班概览',
      '修改登录密码',
      '退出登录',
      '尚未登录',
      '大字号',
    ]) {
      expect(plan).toContain(phrase);
    }
  });
});
