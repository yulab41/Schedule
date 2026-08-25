export {};

Page({
  data: { groupId: '' },
  onLoad(
    this: { setData(patch: { readonly groupId: string }): void },
    query: Readonly<Record<string, string | undefined>>,
  ): void {
    this.setData({ groupId: query['groupId'] ?? '' });
  },
});
