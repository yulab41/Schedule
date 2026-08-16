import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./ExportDialog.vue', import.meta.url)), 'utf8');

describe('export dialog regression coverage', () => {
  it('loads exportable memberships independently from schedule role assignments', () => {
    expect(source).toContain('api.listGroupMembers(props.group.id)');
    expect(source).toContain('member.isPendingRoster !== true');
    expect(source).not.toContain('const memberMap = new Map<string, string>()');
  });

  it('keeps the completed blob URL available for a fallback CSV link', () => {
    expect(source).toContain('const downloadUrl = ref<string>()');
    expect(source).toContain(':href="downloadUrl"');
    expect(source).toContain('下载 CSV');
    expect(source).toContain('onBeforeUnmount(() =>');
    expect(source).not.toMatch(/anchor\.click\(\);\s*URL\.revokeObjectURL\(url\)/s);
  });

  it('stops background polling and blob creation after the sheet unmounts', () => {
    expect(source).toContain('let isUnmounted = false');
    expect(source).toContain('isCancelled: () => isUnmounted');
    expect(source).toContain('if (isUnmounted) return;');
  });

  it('continues checking the retained job after a timeout without creating another task', () => {
    expect(source).toContain('const activeJobId = ref<string>()');
    expect(source).toContain('async function continueChecking(): Promise<void>');
    expect(source).toContain('await checkExistingJob(activeJobId.value)');
    expect(source).toContain('通常 1 分钟内完成');
    expect(source).toContain('继续检查');
  });
});
