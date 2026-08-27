import { recordMiniTelemetryBoundary } from '../../../../platform/telemetry.js';
import { createGroupSettingsPanelControllerDefinition } from '../../components/group-settings-panel/controller.js';

const controller = createGroupSettingsPanelControllerDefinition(false);
type GroupSettingsPageInstance = ThisParameterType<typeof controller.onLoad>;

Page({
  ...controller,
  onLoad(
    this: GroupSettingsPageInstance,
    query: Readonly<Record<string, string | undefined>>,
  ): void {
    recordMiniTelemetryBoundary('group-settings:page-onload');
    controller.onLoad.call(this, query);
  },
} as never);
