import { createExportsPanelControllerDefinition } from '../../components/exports-panel/controller.js';

const controller = createExportsPanelControllerDefinition();
type ExportsPageInstance = ThisParameterType<typeof controller.lifetimes.attached>;

Page({
  data: controller.data,
  ...controller.methods,
  onLoad(
    this: ExportsPageInstance,
    query: Readonly<Record<string, string | undefined>> = {},
  ): void {
    this._directPage = true;
    this.setData({ groupId: decodeGroupId(query['groupId']) });
    controller.lifetimes.attached.call(this);
  },
  onShow(this: ExportsPageInstance): void {
    controller.pageLifetimes.show.call(this);
  },
  onHide(this: ExportsPageInstance): void {
    controller.pageLifetimes.hide.call(this);
  },
  onUnload(this: ExportsPageInstance): void {
    controller.lifetimes.detached.call(this);
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
