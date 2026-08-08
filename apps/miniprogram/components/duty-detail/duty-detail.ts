Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
    detail: {
      type: Object,
      value: null,
    },
  },
  methods: {
    onClose() {
      this.triggerEvent('close');
    },
    onCall(event: WechatMiniprogram.TouchEvent) {
      const number = event.currentTarget.dataset.number;
      if (typeof number === 'string' && number.length > 0) {
        this.triggerEvent('call', { number });
      }
    },
  },
});
