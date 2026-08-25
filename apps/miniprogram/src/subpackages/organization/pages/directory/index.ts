export {};

Page({
  data: { directoryKind: 'internal' as const, groupId: '' },
  onLoad(
    this: {
      setData(patch: { readonly directoryKind: 'internal'; readonly groupId: string }): void;
    },
    query: Readonly<Record<string, string | undefined>>,
  ): void {
    this.setData({ groupId: decodeGroupId(query['groupId']), directoryKind: 'internal' });
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
