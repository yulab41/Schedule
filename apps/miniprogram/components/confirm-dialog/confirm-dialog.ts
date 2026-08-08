Component({
  properties: {
    title: {
      type: String,
      value: '请确认',
    },
    content: {
      type: String,
      value: '',
    },
    visible: {
      type: Boolean,
      value: false,
    },
    confirmText: {
      type: String,
      value: '确认',
    },
    cancelText: {
      type: String,
      value: '取消',
    },
  },
  methods: {
    onCancel() {
      this.triggerEvent('cancel');
    },
    onConfirm() {
      this.triggerEvent('confirm');
    },
    noop() {
      // 阻止冒泡关闭
    },
  },
});
