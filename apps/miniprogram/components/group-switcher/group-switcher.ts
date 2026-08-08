Component({
  properties: {
    groups: {
      type: Array,
      value: [] as { readonly id: string; readonly name: string; readonly role: string }[],
    },
    selectedId: {
      type: String,
      value: '',
    },
  },
  data: {
    index: 0,
    names: [] as string[],
  },
  observers: {
    'groups, selectedId': function update(
      groups: { readonly id: string; readonly name: string; readonly role: string }[],
      selectedId: string,
    ) {
      const names = groups.map((group) => {
        const roleLabel =
          group.role === 'owner'
            ? '群主'
            : group.role === 'administrator'
              ? '管理员'
              : group.role === 'guest'
                ? '访客'
                : '成员';
        return `${group.name}（${roleLabel}）`;
      });
      const index = Math.max(
        0,
        groups.findIndex((group) => group.id === selectedId),
      );
      this.setData({ index, names });
    },
  },
  methods: {
    onPickerChange(event: WechatMiniprogram.PickerChange) {
      const index = Number(event.detail.value ?? 0);
      const groups = this.data.groups as { readonly id: string }[];
      const group = groups[index];
      if (group !== undefined) {
        this.triggerEvent('change', { groupId: group.id });
      }
    },
  },
});
