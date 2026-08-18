interface ManualScheduleCellInstance {
  readonly properties: {
    readonly columnIndex: number;
    readonly disabled: boolean;
    readonly keyValue: string;
    readonly rowIndex: number;
  };
  triggerEvent(name: string, detail?: unknown): void;
}

Component({
  options: {
    virtualHost: true,
  },
  properties: {
    abbreviation: { type: String, value: '' },
    ariaLabel: { type: String, value: '' },
    color: { type: String, value: '' },
    columnIndex: { type: Number, value: 0 },
    disabled: { type: Boolean, value: false },
    isSelected: { type: Boolean, value: false },
    isStale: { type: Boolean, value: false },
    keyValue: { type: String, value: '' },
    rowIndex: { type: Number, value: 0 },
    textColor: { type: String, value: '' },
  },
  methods: {
    handleSelect(this: ManualScheduleCellInstance): void {
      if (this.properties.disabled) return;
      this.triggerEvent('select', {
        columnIndex: this.properties.columnIndex,
        key: this.properties.keyValue,
        rowIndex: this.properties.rowIndex,
      });
    },
  },
});
