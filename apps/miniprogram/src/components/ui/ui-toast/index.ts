import { readTopOverlayOffset } from '../../../platform/top-overlay.js';

type ToastTone = 'success' | 'info' | 'warning' | 'error';

interface ToastInstance {
  _attachment?: object;
  _resize?: () => void;
  _offResize?: () => void;
  readonly properties: {
    readonly visible: boolean;
    readonly title: string;
    readonly message: string;
    readonly tone: string;
    readonly topOffset: number;
  };
  setData(patch: Readonly<Record<string, unknown>>): void;
}

interface WindowResizeRuntime {
  onWindowResize?(listener: () => void): void;
  offWindowResize?(listener: () => void): void;
}

function updatePresentation(instance: ToastInstance): void {
  if (instance._attachment === undefined) return;
  const { visible, title, message, tone, topOffset } = instance.properties;
  const isVisible = visible && (title !== '' || message !== '');
  const patch: Record<string, unknown> = { isVisible };
  if (isVisible) {
    patch['safeTopOffset'] = readTopOverlayOffset(topOffset);
    patch['displayTitle'] = title;
    patch['displayMessage'] = message;
    patch['displayTone'] = (['success', 'info', 'warning', 'error'] as readonly string[]).includes(
      tone,
    )
      ? (tone as ToastTone)
      : 'info';
  }
  // Keep the last text while CSS fades out; visibility and the 2s lifetime belong to the host.
  instance.setData(patch);
}

Component({
  options: { virtualHost: true },
  properties: {
    visible: { type: Boolean, value: false },
    title: { type: String, value: '' },
    message: { type: String, value: '' },
    tone: { type: String, value: 'info' },
    topOffset: { type: Number, value: 0 },
  },
  data: {
    isVisible: false,
    displayTitle: '',
    displayMessage: '',
    displayTone: 'info',
    safeTopOffset: 0,
  },
  observers: {
    'visible,title,message,tone,topOffset'(this: ToastInstance): void {
      updatePresentation(this);
    },
  },
  lifetimes: {
    attached(this: ToastInstance): void {
      const attachment = {};
      this._attachment = attachment;
      const runtime = wx as unknown as WindowResizeRuntime;
      const resize = () => {
        if (this._attachment === attachment) updatePresentation(this);
      };
      this._resize = resize;
      if (runtime.onWindowResize !== undefined && runtime.offWindowResize !== undefined) {
        runtime.onWindowResize(resize);
        this._offResize = () => runtime.offWindowResize?.(resize);
      }
      updatePresentation(this);
    },
    detached(this: ToastInstance): void {
      delete this._attachment;
      this._offResize?.();
      delete this._offResize;
      delete this._resize;
    },
  },
  pageLifetimes: {
    show(this: ToastInstance): void {
      updatePresentation(this);
    },
    resize(this: ToastInstance): void {
      updatePresentation(this);
    },
  },
});
