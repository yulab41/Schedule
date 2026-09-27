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
    vi.stubGlobal('wx', { nextTick: (callback) => ticks.push(callback) });
    await import('../src/components/calendar/calendar-fit-line/index.ts');
    const measurements = [];
    const query = {
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
      properties: { active: true, contentKey: '测试名|换' },
      createSelectorQuery: vi.fn(() => query),
      setData: vi.fn(function (patch) {
        Object.assign(this.data, patch);
      }),
    };
    const update = () => definition.observers['contentKey, active'].call(instance);
    const flush = () => {
      while (ticks.length) ticks.shift()();
    };
    const measure = (available, natural) =>
      measurements.shift()([{ width: available }, { width: natural }]);
    update();
    expect(instance.createSelectorQuery).not.toHaveBeenCalled();
    definition.lifetimes.ready.call(instance);
    return { definition, instance, ticks, measurements, update, flush, measure };
  }

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
    h.measure(40, 20);
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
    h.definition.pageLifetimes.resize.call(h.instance);
    h.flush();
    h.definition.lifetimes.detached.call(h.instance);
    h.measure(30, 300);
    expect(h.instance.data.fitScale).toBe(0.5);
  });
});
