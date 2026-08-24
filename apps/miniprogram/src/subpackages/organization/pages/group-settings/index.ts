export {};

Page({
  data: { groupId: '' },
  onLoad(
    this: { setData(patch: { readonly groupId: string }): void },
    query: Readonly<Record<string, string | undefined>>,
  ): void {
    this.setData({ groupId: decodeGroupId(query['groupId']) });
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
