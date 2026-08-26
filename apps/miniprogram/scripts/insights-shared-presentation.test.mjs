import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

describe('insights shared presentation parity', () => {
  it('uses presentation-core and removes private event/statistics algorithms', () => {
    const controller = read(
      'src/subpackages/insights/components/insights-dashboard-panel/controller.ts',
    );

    expect(controller).toContain("from '@schedule/presentation-core'");
    expect(controller).toContain('getEventTypeLabel');
    expect(controller).toContain('getEventStatusLabel');
    expect(controller).toContain('getStatisticsSummaryItems');
    expect(controller).toContain('sortMembersByActualCount');
    expect(controller).not.toContain('function eventTypeLabel');
    expect(controller).not.toContain('function toStatisticsCards');
    expect(controller).not.toContain('function formatDateTime');
  });

  it('renders grouped pagination and the complete Web statistics ledger', () => {
    const controller = read(
      'src/subpackages/insights/components/insights-dashboard-panel/controller.ts',
    );
    const template = read(
      'src/subpackages/insights/components/insights-dashboard-panel/index.wxml',
    );

    expect(controller).toContain('handleLoadMoreEvents');
    expect(controller).toContain('getYearStatistics');
    expect(template).toContain('eventGroups');
    expect(template).toContain('statisticsPeriodLabel');
    expect(template).toContain('primaryStatistics');
    expect(template).toContain('secondaryStatistics');
    expect(template).toContain('memberRows');
    expect(template).toContain('shiftTypeRows');
    expect(template).not.toContain('eventItem.operationId');
    expect(template).not.toContain('eventItem.beforeData');
    expect(template).not.toContain('eventItem.afterData');
    const buildTools = read('scripts/build-tools.mjs');
    expect(buildTools).toContain("'@schedule/presentation-core/event'");
    expect(buildTools).toContain("'@schedule/presentation-core/statistics'");
  });
});
