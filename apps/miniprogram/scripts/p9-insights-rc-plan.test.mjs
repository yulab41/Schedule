import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P9 insights RC plan', () => {
  it('locks the current candidate and closed production capabilities', () => {
    const plan = read('docs/runbooks/p9-insights-rc.md');
    expect(plan).toContain('0.1.0-p9.20260827.31');
    expect(plan).toContain('insights=false');
    expect(plan).toContain('externalMessages=false');
    expect(plan).toContain('P9 数据与消息 RC 通过');
    expect(plan).toContain('不提交审核或正式发布');
  });

  it('covers privacy, notification, export and size boundaries', () => {
    const plan = read('docs/runbooks/p9-insights-rc.md');
    for (const phrase of [
      '原始 payload',
      'visitor key',
      'wx.downloadFile',
      'wx.openDocument',
      '不含 token',
      '不写相册',
      '大字号',
      '320',
      '订阅授权桥',
    ]) {
      expect(plan).toContain(phrase);
    }
  });
});
