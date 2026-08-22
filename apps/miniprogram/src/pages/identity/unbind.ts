import { buildInfo } from '../../platform/build-info.js';
import { getIdentityErrorMessage, unbindWechatIdentity } from '../../platform/wechat-identity.js';

type UnbindMode = 'confirm' | 'success';

interface UnbindPageInstance {
  _idempotencyKey: string;
  data: {
    readonly buildLabel: string;
    readonly errorMessage: string;
    readonly loading: boolean;
    readonly mode: UnbindMode;
  };
  setData(patch: Partial<UnbindPageInstance['data']>): void;
}

function createIdempotencyKey(): string {
  const seed = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const hex = seed
    .replace(/[^a-f0-9]/giu, '')
    .padEnd(32, '0')
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

Page({
  data: {
    buildLabel: buildInfo.buildLabel,
    errorMessage: '',
    loading: false,
    mode: 'confirm' as UnbindMode,
  },

  handleUnbind(this: UnbindPageInstance): void {
    if (this.data.loading || this.data.mode !== 'confirm') return;
    this.setData({ errorMessage: '', loading: true });
    void unbindWechatIdentity(this._idempotencyKey)
      .then(() => this.setData({ errorMessage: '', loading: false, mode: 'success' }))
      .catch((error: unknown) =>
        this.setData({ errorMessage: getIdentityErrorMessage(error), loading: false }),
      );
  },

  onLoad(this: UnbindPageInstance): void {
    this._idempotencyKey = createIdempotencyKey();
  },
});
