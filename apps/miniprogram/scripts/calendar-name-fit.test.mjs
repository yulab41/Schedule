import { readFileSync } from 'node:fs';
import { describe, expect, it, vi, afterEach } from 'vitest';

const read = (file) => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');

describe('calendar full-name display contract', () => {
  it('never ellipsizes month or list names or wraps week names', () => {
    for (const [file, selector] of [
      ['components/calendar/calendar-cell/index.wxss', '.month-person'],
      ['pages/workbench/index.wxss', '.list-duty-name'],
      ['pages/workbench/index.wxss', '.week-duty-name'],
      ['components/calendar/calendar-week-panel/index.wxss', '.week-duty-name'],
    ]) {
      const block = read(file)
        .slice(read(file).indexOf(`${selector} {`))
        .split('}')[0];
      expect(block, `${file} ${selector}`).not.toContain('text-overflow: ellipsis');
      expect(block, `${file} ${selector}`).toContain('white-space: nowrap');
    }
  });

  it('fits month and list rows together while week names and badges stay on separate rows', () => {
    const month = read('components/calendar/calendar-cell/index.wxml');
    expect(month).toMatch(
      /<calendar-fit-line[^>]*>[\s\S]*class="month-person"[\s\S]*class="duty-abbreviation"[\s\S]*<\/calendar-fit-line>/u,
    );
    expect(month).toMatch(
      /<calendar-fit-line[^>]*>[\s\S]*class="month-person"[\s\S]*class="change-mark"[\s\S]*<\/calendar-fit-line>/u,
    );
    for (const file of [
      'pages/workbench/index.wxml',
      'pages/guest/guest.wxml',
      'components/calendar/calendar-week-panel/index.wxml',
    ]) {
      const view = read(file);
      expect(view).toMatch(
        /<calendar-fit-line[^>]*>\s*<text class="week-duty-name">\{\{duty.name\}\}<\/text>\s*<\/calendar-fit-line>\s*<view[\s\S]{0,150}class="week-duty-badges"/u,
      );
      expect(view).toContain('class="week-group-title"');
      if (file.startsWith('pages/'))
        expect(view).toMatch(
          /class="list-duty-name-line"[\s\S]*<calendar-fit-line[^>]*>[\s\S]*class="list-duty-name"[\s\S]*class="list-change-badge"[\s\S]*<\/calendar-fit-line>/u,
        );
    }
  });

  it('uses a persistent indicator driven by viewMode on both calendar entrypoints', () => {
    for (const file of ['pages/workbench/index.wxml', 'pages/guest/guest.wxml']) {
      const view = read(file);
      expect(view).toContain('class="view-switch is-{{viewMode}}"');
      expect(view).toContain('class="view-switch-indicator" aria-hidden="true"');
    }
    const css = read('pages/workbench/index.wxss');
    expect(css).toContain('transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1)');
    expect(css).toContain('color 180ms ease');
    expect(css).toMatch(/prefers-reduced-motion:[\s\S]*\.view-switch-indicator/u);
  });
});

describe('calendar fit measurement lifecycle', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function mount() {
    vi.resetModules();
    let definition;
    vi.stubGlobal('Component', (value) => {
      definition = value;
    });
    const ticks = [];
    vi.stubGlobal('wx', {
      nextTick: (callback) => ticks.push(callback),
      getWindowInfo: () => ({ windowWidth: 390 }),
    });
    await import('../src/components/calendar/calendar-fit-line/index.ts');
    const measurements = [];
    const query = {
      in() {
        return this;
      },
      select() {
        return this;
      },
      boundingClientRect() {
        return this;
      },
      exec(callback) {
        measurements.push(callback);
      },
    };
    const instance = {
      data: { ...definition.data },
      properties: {
        active: true,
        contentKey: '测试名|换',
        maxScale: 1,
        centered: false,
        layout: 'month',
        referenceName: '',
      },
      getPageId: () => 'calendar',
      groupSetData: (callback) => callback(),
      createSelectorQuery: vi.fn(() => query),
      setData: vi.fn(function (patch) {
        Object.assign(this.data, patch);
      }),
    };
    const update = () => Object.values(definition.observers)[0].call(instance);
    const flush = () => {
      while (ticks.length) ticks.shift()();
    };
    const measure = (available, natural, reference = 0) =>
      measurements.shift()([{ width: available }, { width: natural }, { width: reference }]);
    update();
    expect(instance.createSelectorQuery).not.toHaveBeenCalled();
    definition.lifetimes.ready.call(instance);
    return { definition, instance, ticks, measurements, update, flush, measure };
  }

  it('batches 300 nurse rows into one render query rather than 300 bridge round trips', async () => {
    const h = await mount();
    for (let i = 1; i < 300; i++) {
      h.definition.lifetimes.ready.call({
        ...h.instance,
        _fitQueued: false,
        data: { ...h.definition.data },
      });
    }
    h.flush();
    expect(h.measurements).toHaveLength(1);
  });

  it('reuses the fixed three-character reference across different short names and remounts', async () => {
    const h = await mount();
    h.instance.properties.referenceName = '测试名';
    h.instance.properties.maxScale = 1.18;
    h.flush();
    h.measure(49, 46, 46);
    const second = {
      ...h.instance,
      data: { ...h.definition.data },
      properties: { ...h.instance.properties, referenceName: '短名', contentKey: '短名|换' },
    };
    h.definition.lifetimes.detached.call(h.instance);
    h.definition.lifetimes.ready.call(second);
    h.flush();
    expect(h.measurements).toHaveLength(0);
    expect(second.data.fitScale).toBeCloseTo(49 / 46, 3);
    globalThis.wx.getWindowInfo = () => ({ windowWidth: 320 });
    h.definition.pageLifetimes.resize.call(second);
    h.flush();
    expect(h.measurements).toHaveLength(1);
    h.measure(38, 35, 46);
    expect(second.data.fitScale).toBeCloseTo(38 / 46, 3);
  });

  it('measures an exceptional long name once per layout and reuses it on view switches', async () => {
    const h = await mount();
    h.instance.properties.contentKey = 'Alexandra Test|换';
    h.flush();
    h.measure(40, 95, 46);
    const second = { ...h.instance, data: { ...h.definition.data } };
    h.definition.lifetimes.ready.call(second);
    h.flush();
    expect(h.measurements).toHaveLength(0);
    expect(second.data.fitScale).toBeCloseTo(40 / 95, 3);
  });

  it('fits every row even when one batch exceeds the bounded cache', async () => {
    const h = await mount();
    const rows = [h.instance];
    for (let i = 1; i < 600; i++) {
      const row = {
        ...h.instance,
        data: { ...h.definition.data },
        properties: { ...h.instance.properties, contentKey: `Long test name ${i}` },
      };
      rows.push(row);
      h.definition.lifetimes.ready.call(row);
    }
    h.flush();
    h.measurements.shift()(rows.flatMap(() => [{ width: 40 }, { width: 80 }, { width: 0 }]));
    expect(rows.every((row) => row.data.fitScale === 0.5)).toBe(true);
  });

  it('fills spare month width up to the font cap and preserves the scale for other rows', async () => {
    const h = await mount();
    h.instance.properties.maxScale = 1.18;
    h.flush();
    h.measure(49, 46);
    expect(h.instance.data.fitScale).toBeCloseTo(49 / 46, 3);
    globalThis.wx.getWindowInfo = () => ({ windowWidth: 700 });
    h.definition.pageLifetimes.resize.call(h.instance);
    h.flush();
    h.measure(100, 46);
    expect(h.instance.data.fitScale).toBe(1.18);
  });

  it('keeps two- and three-character names at the same reference size; long names shrink only to fit', async () => {
    const h = await mount();
    h.instance.properties.maxScale = 1.18;
    h.flush();
    h.measure(49, 35, 46);
    expect(h.instance.data.fitScale).toBeCloseTo(49 / 46, 3);
    h.instance.properties.contentKey = '三字名|换';
    h.update();
    h.flush();
    h.measure(49, 46, 46);
    expect(h.instance.data.fitScale).toBeCloseTo(49 / 46, 3);
    h.instance.properties.contentKey = '很长的姓名|换';
    h.update();
    h.flush();
    h.measure(49, 68, 46);
    expect(h.instance.data.fitScale).toBeCloseTo(49 / 68, 3);
  });

  it('coalesces changes, shrinks only overflowing rows, and restores full size for shorter content', async () => {
    const h = await mount();
    h.update();
    h.update();
    h.flush();
    expect(h.instance.createSelectorQuery).toHaveBeenCalledTimes(1);
    h.measure(40, 50);
    expect(h.instance.data.fitScale).toBe(0.8);
    h.instance.properties.contentKey = '短名';
    h.update();
    h.flush();
    h.measure(40, 20);
    expect(h.instance.data.fitScale).toBe(1);
    h.update();
    h.flush();
    expect(h.measurements).toHaveLength(0);
    expect(h.instance.setData).toHaveBeenCalledTimes(2);
  });

  it('ignores stale and detached results and waits for hidden containers to become visible', async () => {
    const h = await mount();
    h.flush();
    h.update();
    h.flush();
    h.measure(20, 50);
    expect(h.instance.data.fitScale).toBe(1);
    h.measure(0, 50);
    expect(h.instance.setData).not.toHaveBeenCalled();
    h.instance.properties.active = false;
    h.update();
    h.flush();
    expect(h.measurements).toHaveLength(0);
    h.instance.properties.active = true;
    h.update();
    h.flush();
    h.measure(30, 60);
    expect(h.instance.data.fitScale).toBe(0.5);
    globalThis.wx.getWindowInfo = () => ({ windowWidth: 320 });
    h.definition.pageLifetimes.resize.call(h.instance);
    h.flush();
    h.definition.lifetimes.detached.call(h.instance);
    h.measure(30, 300);
    expect(h.instance.data.fitScale).toBe(0.5);
  });
});
