import { createSchedulingConfigPanelControllerDefinition } from '../../components/scheduling-config-panel/controller.js';

const controller = createSchedulingConfigPanelControllerDefinition();
const pageMethods = Object.fromEntries(
  Object.entries(controller).filter(
    ([key, value]) => key.startsWith('handle') && typeof value === 'function',
  ),
);
type SchedulingConfigPageInstance = ThisParameterType<typeof controller.lifetimes.attached>;

Page({
  data: controller.data,
  ...pageMethods,
  onLoad(
    this: SchedulingConfigPageInstance,
    query: Readonly<Record<string, string | undefined>>,
  ): void {
    (this as unknown as { properties: { groupId: string } }).properties = {
      groupId: decodeGroupId(query['groupId']),
    };
    controller.lifetimes.attached.call(this);
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
