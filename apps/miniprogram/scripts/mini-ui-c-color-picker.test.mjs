import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pickerRoot = 'subpackages/organization/components/shift-color-picker';
const read = (file) => readFileSync(path.join(process.cwd(), 'src', file), 'utf8');
let definition;

beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

async function colorTools() {
  return import('../src/subpackages/organization/components/shift-color-picker/color.ts');
}

async function picker(value = '#0F766E', disabled = false) {
  vi.stubGlobal('Component', (value) => {
    definition = value;
  });
  await import('../src/subpackages/organization/components/shift-color-picker/index.ts');
  const instance = {
    ...definition.methods,
    data: { ...structuredClone(definition.data), value, disabled },
    setData(patch) {
      Object.assign(this.data, patch);
    },
    triggerEvent: vi.fn(),
  };
  definition.observers.value.call(instance, value);
  return instance;
}

function geometry(
  instance,
  rect = { left: 30, top: 100, width: 200, height: 100 },
  scroll = { scrollLeft: 0, scrollTop: 0 },
  deferred = false,
) {
  let callback;
  const query = {
    select: vi.fn(() => query),
    boundingClientRect: () => query,
    selectViewport: () => query,
    scrollOffset: () => query,
    exec(fn) {
      callback = fn;
      if (!deferred) fn([rect, scroll]);
    },
  };
  instance.createSelectorQuery = vi.fn(() => query);
  return { query, flush: () => callback([rect, scroll]) };
}

const touch = (clientX, clientY, identifier = 1) => ({ clientX, clientY, identifier });
const event = (point, end = false) =>
  end ? { touches: [], changedTouches: [point] } : { touches: [point] };
const lastValue = (instance) => instance.triggerEvent.mock.calls.at(-1)?.[1]?.value;

describe('task C unique color conversion', () => {
  it('uses all current Web presets in the same order', async () => {
    const { SHIFT_COLOR_PRESETS } = await colorTools();
    const web = readFileSync(
      path.resolve(process.cwd(), '../web/src/features/scheduling-config/ShiftColorPicker.vue'),
      'utf8',
    );
    const colors = web.match(/const palette = \[([^\]]+)\]/u)[1].match(/#[\da-f]{6}/giu);
    expect(SHIFT_COLOR_PRESETS).toEqual(colors);
  });

  it.each(['#0f766e', '0F766E', '  #0f766e  ', ' 0f766e '])(
    'normalizes six-digit HEX %s',
    async (value) => {
      expect((await colorTools()).normalizeHex(value)).toBe('#0F766E');
    },
  );

  it.each(['#fff', 'fff', '', '#12345', '#1234567', '#GG0000', '##112233', '12 3456'])(
    'rejects invalid/Web-unsupported HEX %s',
    async (value) => {
      expect((await colorTools()).normalizeHex(value)).toBeUndefined();
    },
  );

  it.each(['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#808080', '#F0F1F0', '#0F766E'])(
    'round trips %s without quantizing HSV',
    async (hex) => {
      const { hexToHsv, hsvToHex, hexToRgb, rgbToHex } = await colorTools();
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
      expect(rgbToHex(hexToRgb(hex))).toBe(hex);
    },
  );

  it('handles hue wrap, saturation zero, value endpoints and out-of-bounds channels', async () => {
    const { hsvToHex, rgbToHex } = await colorTools();
    expect(hsvToHex({ hue: 0, saturation: 1, value: 1 })).toBe('#FF0000');
    expect(hsvToHex({ hue: 360, saturation: 1, value: 1 })).toBe('#FF0000');
    expect(hsvToHex({ hue: -120, saturation: 1, value: 1 })).toBe('#0000FF');
    expect(hsvToHex({ hue: 90, saturation: 0, value: 1 })).toBe('#FFFFFF');
    expect(hsvToHex({ hue: 90, saturation: 1, value: 0 })).toBe('#000000');
    expect(rgbToHex({ red: -20, green: 300, blue: 127.6 })).toBe('#00FF80');
  });
});

describe('task C color picker interaction', () => {
  it('keeps Web custom toggle semantics and emits normalized preset changes', async () => {
    const instance = await picker('#0A66D5');
    instance.handleCustomToggle();
    expect(instance.data.customOpen).toBe(true);
    expect(instance.data.customColor).toBe('#7A4FD6');
    instance.handleHexInput({ detail: { value: '0f766e' } });
    instance.handleApply();
    expect(lastValue(instance)).toBe('#0F766E');
    expect(instance.data.customOpen).toBe(false);
    instance.handlePreset({ currentTarget: { dataset: { color: '#287D70' } } });
    expect(lastValue(instance)).toBe('#287D70');
    instance.handleCustomToggle();
    expect(instance.data.customColor).toBe('#0F766E');
    instance.triggerEvent.mockClear();
    instance.handleHexInput({ detail: { value: '#ffffff' } });
    instance.handleCustomToggle();
    expect(instance.triggerEvent).not.toHaveBeenCalled();
    instance.handleCustomToggle();
    expect(instance.data.customHex).toBe('#0F766E');
  });

  it('retains the last valid color/indicator on invalid input and external invalid values', async () => {
    const instance = await picker();
    instance.handleCustomToggle();
    const hsv = {
      hue: instance.data.hue,
      saturation: instance.data.saturation,
      brightness: instance.data.brightness,
    };
    instance.handleHexInput({ detail: { value: '#bad' } });
    instance.handleApply();
    expect(instance.data.customColor).toBe('#0F766E');
    expect(instance.data.customColorError).toBe(true);
    expect(instance.data).toMatchObject(hsv);
    definition.observers.value.call(instance, 'invalid');
    expect(instance.data.selectedColor).toBe('#0F766E');
    expect(instance.triggerEvent).not.toHaveBeenCalled();
  });

  it('uses the actual rect, clamps the SV board and consumes start/move/end', async () => {
    const instance = await picker();
    instance.handleCustomToggle();
    const { query } = geometry(instance);
    instance.handleSpectrumStart(event(touch(130, 150)));
    expect(query.select).toHaveBeenCalledWith('#shift-color-spectrum');
    expect(instance.data.saturation).toBe(0.5);
    expect(instance.data.brightness).toBe(0.5);
    instance.handleTouchMove(event(touch(400, -20)));
    expect(instance.data.saturation).toBe(1);
    expect(instance.data.brightness).toBe(1);
    instance.handleTouchEnd(event(touch(-100, 1000), true));
    expect(lastValue(instance)).toBe('#000000');
    instance.triggerEvent.mockClear();
    instance.handleTouchMove(event(touch(100, 100)));
    expect(instance.triggerEvent).not.toHaveBeenCalled();
    for (const value of Object.values(instance.data)) expect(String(value)).not.toContain('NaN');
  });

  it('keeps the final point when the query completes after touchend and handles page scroll fallback', async () => {
    const instance = await picker();
    instance.handleCustomToggle();
    const bounds = geometry(instance, undefined, { scrollTop: 500, scrollLeft: 20 }, true);
    instance.handleSpectrumStart(event({ pageX: 150, pageY: 650, identifier: 2 }));
    instance.handleTouchEnd(event({ pageX: 250, pageY: 600, identifier: 2 }, true));
    bounds.flush();
    expect(instance.data.saturation).toBe(1);
    expect(instance.data.brightness).toBe(1);
  });

  it('maps both hue endpoints to red and ignores secondary touches', async () => {
    const instance = await picker('#FF0000');
    instance.handleCustomToggle();
    geometry(instance);
    instance.handleHueStart(event(touch(30, 120)));
    expect(lastValue(instance)).toBe('#FF0000');
    instance.handleTouchMove(event(touch(130, 120, 7)));
    expect(instance.data.hue).toBe(0);
    instance.handleTouchEnd(event(touch(230, 120), true));
    expect(instance.data.hue).toBe(360);
    expect(lastValue(instance)).toBe('#FF0000');
    definition.observers.value.call(instance, '#FF0000');
    expect(instance.data.hue).toBe(360);
  });

  it.each(['cancel', 'resize', 'detach', 'disabled'])(
    'discards pending measurements on %s and remeasures the next gesture',
    async (action) => {
      const instance = await picker();
      instance.handleCustomToggle();
      const pending = geometry(instance, undefined, undefined, true);
      instance.handleSpectrumStart(event(touch(130, 150)));
      if (action === 'cancel') instance.handleTouchCancel();
      if (action === 'resize') definition.pageLifetimes.resize.call(instance);
      if (action === 'detach') definition.lifetimes.detached.call(instance);
      if (action === 'disabled') {
        instance.data.disabled = true;
        definition.observers.disabled.call(instance, true);
      }
      pending.flush();
      expect(instance.triggerEvent).not.toHaveBeenCalled();
      if (action === 'detach' || action === 'disabled') return;
      geometry(instance, { left: 100, top: 20, width: 400, height: 80 });
      instance.handleSpectrumStart(event(touch(200, 60)));
      expect(instance.data.saturation).toBe(0.25);
      expect(instance.data.brightness).toBe(0.5);
    },
  );

  it('does not interact when disabled and isolates custom drafts per instance', async () => {
    const disabled = await picker('#0F766E', true);
    disabled.handleCustomToggle();
    disabled.handlePreset({ currentTarget: { dataset: { color: '#C33D56' } } });
    disabled.handleHexInput({ detail: { value: '#FFFFFF' } });
    disabled.handleApply();
    disabled.handleSpectrumStart(event(touch(10, 10)));
    expect(disabled.triggerEvent).not.toHaveBeenCalled();
    expect(disabled.data.customColor).toBe('#0F766E');
    const first = await picker('#FF0000');
    const second = await picker('#0000FF');
    first.handleCustomToggle();
    first.handleHexInput({ detail: { value: '#00ff00' } });
    first.handleApply();
    expect(second.data.customColor).toBe('#0000FF');
  });

  it('registers the same picker for new/edit forms and captures drag only on its two controls', () => {
    const form = read('subpackages/organization/components/scheduling-config-panel/index.wxml');
    expect(form.match(/<shift-color-picker\b/gu)).toHaveLength(2);
    expect(form).not.toContain('native-color');
    for (const file of ['components/scheduling-config-panel', 'pages/scheduling-config']) {
      const config = JSON.parse(read(`subpackages/organization/${file}/index.json`));
      expect(config.usingComponents['shift-color-picker']).toBe(
        '/subpackages/organization/components/shift-color-picker/index',
      );
    }
    const template = read(`${pickerRoot}/index.wxml`);
    expect(template.match(/catchtouchmove="handleTouchMove"/gu)).toHaveLength(2);
    expect(template.match(/catchtouchcancel="handleTouchCancel"/gu)).toHaveLength(2);
    expect(template).toContain('customOpen');
    expect(template).toContain('spectrum-cursor');
    expect(template).toContain('hue-cursor');
    expect(template).toContain('bindtap="handleApply"');
  });
});
