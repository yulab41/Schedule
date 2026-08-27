import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';
import { createInsightsDashboardPanelControllerDefinition } from '../../components/insights-dashboard-panel/controller.js';

const controller = createInsightsDashboardPanelControllerDefinition();
type InsightsPageInstance = ThisParameterType<typeof controller.lifetimes.attached>;

Page({
  data: controller.data,
  ...controller.methods,
  onLoad(this: InsightsPageInstance, query: Readonly<Record<string, string | undefined>>): void {
    recordMiniTelemetryBoundary('insights:page-onload');
    (this as unknown as { properties: { groupId: string } }).properties = {
      groupId: decodeGroupId(query['groupId']),
    };
    controller.lifetimes.attached.call(this);
  },
  onUnload(this: InsightsPageInstance): void {
    controller.lifetimes.detached.call(this);
  },
} as never);

function decodeGroupId(value: string | undefined): string {
  if (value === undefined) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}
