import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';
import { createPlatformAccountsPanelControllerDefinition } from '../../components/platform-accounts-panel/controller.js';

const controller = createPlatformAccountsPanelControllerDefinition();
const pageMethods = Object.fromEntries(
  Object.entries(controller).filter(
    ([key, value]) =>
      (key.startsWith('handle') || key === 'preventTouchMove') && typeof value === 'function',
  ),
);
type PlatformAccountsPageInstance = ThisParameterType<typeof controller.lifetimes.attached>;

Page({
  data: { ...controller.data, groupId: '' },
  ...pageMethods,
  onLoad(
    this: PlatformAccountsPageInstance,
    query: Readonly<Record<string, string | undefined>>,
  ): void {
    recordMiniTelemetryBoundary('platform-accounts:page-onload');
    this.setData({ groupId: query['groupId'] ?? '' } as never);
    controller.lifetimes.attached.call(this);
  },
} as never);
