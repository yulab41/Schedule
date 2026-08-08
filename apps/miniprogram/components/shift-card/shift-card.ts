Component({
  properties: {
    assignment: {
      type: Object,
      value: null,
    },
  },
  methods: {
    onTap() {
      this.triggerEvent('tap');
    },
  },
});
