import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('workflow setting switches', () => {
  it.each([
    ['换班', '../swaps/SwapPanel.vue'],
    ['加扣班', '../duty-adjustments/DutyAdjustmentPanel.vue'],
  ])('uses the shared Apple-style switch for %s settings', (_, relativePath) => {
    const source = readSource(relativePath);

    expect(source).toContain("import CompactSwitch from '../../components/CompactSwitch.vue';");
    expect(source.match(/<CompactSwitch/g)).toHaveLength(2);
    expect(source).not.toContain('type="checkbox"');
    expect(source).toContain('@update:model-value="updateGroupRequiresApproval"');
    expect(source).toContain('@update:model-value="updateAutoAccept"');
  });
});
