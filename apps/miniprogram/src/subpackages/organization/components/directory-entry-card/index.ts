interface DirectoryEntryCardValue {
  readonly favorite: boolean;
  readonly id: string;
  readonly title: string;
}

interface DirectoryEntryCardInstance {
  readonly properties: { readonly entry: DirectoryEntryCardValue | null };
  triggerEvent(name: string, detail: Readonly<Record<string, string>>): void;
}

Component({
  properties: {
    entry: { type: Object, value: null },
  },
  methods: {
    handleFavorite(this: DirectoryEntryCardInstance): void {
      const entry = this.properties.entry;
      if (entry !== null) this.triggerEvent('favoritechange', { groupId: entry.id });
    },
    handleCall(
      this: DirectoryEntryCardInstance,
      event: {
        readonly currentTarget: { readonly dataset: { readonly number?: string } };
      },
    ): void {
      const entry = this.properties.entry;
      const number = event.currentTarget.dataset.number;
      if (entry !== null && number !== undefined) {
        this.triggerEvent('directorycall', { groupId: entry.id, number });
      }
    },
  },
});
