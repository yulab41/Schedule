import { recordExportRenderStage } from '../../../../platform/export-render-diagnostics.js';
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
    recordExportRenderStage('page-load');
    this._directPage = true;
    this.setData({ groupId: decodeGroupId(query['groupId']) });
    controller.lifetimes.attached.call(this);
  },
  onReady(): void {
    recordExportRenderStage('page-ready');
  },
  onShow(this: ExportsPageInstance): void {
    recordExportRenderStage('page-show');
    controller.pageLifetimes.show.call(this);
  },
  onHide(this: ExportsPageInstance): void {
    controller.pageLifetimes.hide.call(this);
  },
  onUnload(this: ExportsPageInstance): void {
    controller.lifetimes.detached.call(this);
    recordExportRenderStage('page-unload');
  },
});

recordExportRenderStage('module-registered');

function decodeGroupId(value: string | undefined): string {
  if (value === undefined) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return '';
  }
}
