Component({
  properties: {
    columns: {
      type: Array,
      value: [] as { readonly cycleDay: number; readonly date: string; readonly weekday: string }[],
    },
    rows: {
      type: Array,
      value: [] as {
        readonly isStale: boolean;
        readonly membershipId: string;
        readonly realName: string;
      }[],
    },
    grid: {
      type: Array,
      value: [] as {
        readonly cells: readonly {
          readonly abbreviation: string;
          readonly color: string;
          readonly cycleDay: number;
          readonly isStale: boolean;
          readonly key: string;
          readonly membershipId: string;
          readonly shiftTypeId: string;
          readonly shiftTypeName: string;
          readonly textColor: string;
        }[];
        readonly membershipId: string;
      }[],
    },
    selected: {
      type: Object,
      value: null,
    },
  },
  methods: {
    onCellTap(event: WechatMiniprogram.TouchEvent) {
      const cycleDay = Number(event.currentTarget.dataset.cycleDay ?? 0);
      const membershipId = event.currentTarget.dataset.membershipId;
      if (cycleDay > 0 && typeof membershipId === 'string' && membershipId.length > 0) {
        this.triggerEvent('celltap', { cycleDay, membershipId });
      }
    },
  },
});
