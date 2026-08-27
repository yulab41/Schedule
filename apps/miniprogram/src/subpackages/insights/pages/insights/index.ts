import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';

Page({
  data: { groupId: '' },
  onLoad(
    this: { setData(patch: { readonly groupId: string }): void },
    query: Readonly<Record<string, string | undefined>>,
  ): void {
    recordMiniTelemetryBoundary('insights:page-onload');
    this.setData({ groupId: decodeGroupId(query['groupId']) });
  },
});

function decodeGroupId(value: string | undefined): string {
  if (value === undefined) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}
