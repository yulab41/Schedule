import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('P9/P10 loading-state safety', () => {
  it('turns a missing groupId into an actionable error for every group-bound panel', () => {
    for (const relativePath of [
      'src/subpackages/organization/components/directory-panel/controller.ts',
      'src/subpackages/insights/components/visitor-access-panel/controller.ts',
      'src/subpackages/insights/components/insights-dashboard-panel/controller.ts',
      'src/subpackages/insights/components/notifications-panel/controller.ts',
      'src/subpackages/insights/components/exports-panel/controller.ts',
    ]) {
      const source = read(relativePath);
      expect(source).toContain('groupId.length === 0');
      expect(source).toContain('当前群组信息缺失，请返回工作台后重试。');
      expect(source).toContain("state: 'error'");
    }
  });
});
