interface DirectoryEntryCardValue {
  readonly favorite: boolean;
  readonly id: string;
  readonly title: string;
}

interface DirectoryEntryCardInstance {
  _phoneMotionTimer: unknown;
  readonly properties: {
    readonly entry: DirectoryEntryCardValue | null;
    readonly disabled: boolean;
    readonly largeText: boolean;
    readonly showDivider: boolean;
  };
  setData(patch: Readonly<Record<string, unknown>>, callback?: () => void): void;
  triggerEvent(name: string, detail: Readonly<Record<string, string>>): void;
}

Component({
  properties: {
    disabled: { type: Boolean, value: false },
    entry: { type: Object, value: null },
    largeText: { type: Boolean, value: false },
    showDivider: { type: Boolean, value: false },
  },
  data: {
    animatingNumberId: '',
  },
  lifetimes: {
    attached(this: DirectoryEntryCardInstance): void {
      this._phoneMotionTimer = undefined;
    },
    detached(this: DirectoryEntryCardInstance): void {
      if (this._phoneMotionTimer !== undefined) clearTimeout(this._phoneMotionTimer);
      this._phoneMotionTimer = undefined;
    },
  },
  methods: {
    handleFavorite(this: DirectoryEntryCardInstance): void {
      if (this.properties.disabled) return;
      const entry = this.properties.entry;
      if (entry !== null) this.triggerEvent('favoritechange', { groupId: entry.id });
    },
    handleCall(
      this: DirectoryEntryCardInstance,
      event: {
        readonly currentTarget: {
          readonly dataset: { readonly number?: string; readonly numberId?: string };
        };
      },
    ): void {
      if (this.properties.disabled) return;
      const entry = this.properties.entry;
      const number = event.currentTarget.dataset.number;
      if (entry !== null && number !== undefined) {
        const numberId = event.currentTarget.dataset.numberId ?? '';
        if (this._phoneMotionTimer !== undefined) clearTimeout(this._phoneMotionTimer);
        this.setData({ animatingNumberId: '' }, () => {
          this.setData({ animatingNumberId: numberId });
          this._phoneMotionTimer = setTimeout(() => {
            this._phoneMotionTimer = undefined;
            this.setData({ animatingNumberId: '' });
          }, 620);
        });
        this.triggerEvent('directorycall', { groupId: entry.id, number });
      }
    },
  },
});
