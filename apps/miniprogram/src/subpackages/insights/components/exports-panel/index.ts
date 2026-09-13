import { createExportsPanelControllerDefinition } from './controller.js';

const definition = createExportsPanelControllerDefinition();
const attached = definition.lifetimes.attached;
type ExportsPanelInstance = ThisParameterType<typeof attached> & {
  triggerEvent(name: string, detail?: unknown): void;
};

Component({
  ...definition,
  lifetimes: {
    ...definition.lifetimes,
    attached(this: ExportsPanelInstance): void {
      attached.call(this);
      this.triggerEvent('startupready');
    },
  },
});
