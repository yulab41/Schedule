import type { GroupSummary } from '@schedule/contracts';

interface GroupSwitcherData {
  readonly names: readonly string[];
  readonly selectedIndex: number;
  readonly selectedName: string;
}

Component({
  properties: {
    groups: { type: Array, value: [] as GroupSummary[] },
    selectedId: { type: String, value: '' },
  },

  data: {
    names: [],
    selectedIndex: 0,
    selectedName: '',
  } as GroupSwitcherData,

  observers: {
    'groups, selectedId': function syncSelection(groups: GroupSummary[], selectedId: string) {
      const names = groups.map((group) => group.name);
      const selectedIndex = Math.max(
        0,
        groups.findIndex((group) => group.id === selectedId),
      );
      this.setData({
        names,
        selectedIndex,
        selectedName: groups[selectedIndex]?.name ?? '',
      });
    },
  },

  methods: {
    handleChange(event: WechatMiniprogram.PickerChange) {
      const index = Number(event.detail.value ?? 0);
      const group = this.data.groups[index] as GroupSummary | undefined;
      if (group !== undefined) {
        this.triggerEvent('change', { groupId: group.id });
      }
    },
  },
});
