import type { DutyDetail } from '../../utils/calendar.js';

interface DutyDetailData {
  readonly visible: boolean;
  readonly detail: DutyDetail | undefined;
}

Component({
  properties: {
    detail: { type: Object, value: null },
    visible: { type: Boolean, value: false },
  },

  data: {
    visible: false,
    detail: undefined,
  } as DutyDetailData,

  methods: {
    handleClose() {
      this.triggerEvent('close');
    },

    handleCall(event: WechatMiniprogram.TouchEvent) {
      const number = event.currentTarget.dataset.number;
      if (typeof number === 'string' && number.length > 0) {
        this.triggerEvent('call', { number });
      }
    },

    noop() {
      // Intentionally empty: stops tap propagation from the modal body.
    },
  },
});
