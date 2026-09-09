import {
  createRenderedOptions,
  scheduleSelectorPlacement,
  validOptionIndex,
  type SelectorInstance,
  type SelectorOption,
} from './selector.js';
interface Instance extends SelectorInstance {
  readonly properties: {
    readonly options: readonly SelectorOption[];
    readonly selectedIndex: number;
    readonly disabled: boolean;
    readonly multiple: boolean;
  };
  triggerEvent(
    name: string,
    detail?: unknown,
    options?: { bubbles?: boolean; composed?: boolean },
  ): void;
}
const instances = new Set<Instance>();
Component({
  properties: {
    fieldLabel: { type: String, value: '' },
    multiple: { type: Boolean, value: false },
    disabled: { type: Boolean, value: false },
    displayValue: { type: String, value: '' },
    options: { type: Array, value: [] },
    placeholder: { type: String, value: '请选择' },
    selectedIndex: { type: Number, value: -1 },
    title: { type: String, value: '请选择' },
  },
  data: {
    open: false,
    renderedOptions: [],
    selectedOptionIndex: -1,
    popoverPlacement: 'down',
    popoverPlacementReady: true,
  },
  lifetimes: {
    attached(this: Instance) {
      instances.add(this);
    },
    detached(this: Instance) {
      instances.delete(this);
    },
  },
  pageLifetimes: {
    hide(this: Instance) {
      this.setData({ open: false });
    },
  },
  observers: {
    options(this: Instance) {
      if (this.data.open)
        this.setData({ renderedOptions: createRenderedOptions(this.properties.options) });
    },
  },
  methods: {
    handleOpen(this: Instance) {
      if (this.properties.disabled) return;
      if (this.data.open) {
        this.setData({ open: false });
        return;
      }
      for (const other of instances)
        if (other !== this && other.data.open) other.setData({ open: false });
      this.triggerEvent('pickerrequestopen', {}, { bubbles: true, composed: true });
      this.setData({
        open: true,
        selectedOptionIndex: validOptionIndex(
          this.properties.options,
          this.properties.selectedIndex,
        ),
        renderedOptions: createRenderedOptions(this.properties.options),
        popoverPlacement: 'down',
        popoverPlacementReady: false,
      });
      scheduleSelectorPlacement(this);
    },
    handleClose(this: Instance) {
      this.setData({ open: false });
    },
    closeFromParent(this: Instance) {
      this.setData({ open: false });
    },
    handleInternalTap() {},
    handleOptionTap(this: Instance, event: { currentTarget: { dataset: { index?: number } } }) {
      if (this.properties.disabled) return;
      const index = Number(event.currentTarget.dataset.index);
      const option = this.properties.options[index];
      if (!Number.isInteger(index) || option === undefined || option.disabled) return;
      if (this.properties.multiple) {
        this.triggerEvent('change', {
          index,
          option,
          value: option.value,
          checked: !option.checked,
        });
        return;
      }
      this.triggerEvent('change', { index, option, value: String(index) });
      this.setData({ open: false, selectedOptionIndex: index });
    },
  },
});
