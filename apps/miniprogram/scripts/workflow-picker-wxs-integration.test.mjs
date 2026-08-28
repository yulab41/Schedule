import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const miniRoot = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(miniRoot, relativePath), 'utf8');
}

describe('production workflow picker WXS wheel integration', () => {
  it('renders exactly two reusable UiWheelColumn instances for month mode', () => {
    const config = JSON.parse(
      read('src/subpackages/workflows/components/workflow-picker/index.json'),
    );
    const template = read('src/subpackages/workflows/components/workflow-picker/index.wxml');
    const monthStart = template.indexOf('wx:if="{{mode === \'month\'}}"');
    const monthEnd = template.indexOf('wx:elif="{{mode === \'date\'}}"', monthStart);
    const monthTemplate = template.slice(monthStart, monthEnd);

    expect(config.usingComponents['ui-wheel-column']).toBe('/components/ui/ui-wheel-column/index');
    expect(monthTemplate.match(/<ui-wheel-column/gu)).toHaveLength(2);
    expect(monthTemplate).toContain('runtime-key="{{yearWheelRuntimeKey}}"');
    expect(monthTemplate).toContain('runtime-key="{{monthWheelRuntimeKey}}"');
    expect(monthTemplate).toContain('generation="{{wheelGeneration}}"');
    expect(monthTemplate).toContain('bindpreviewchange="handleYearWheelPreview"');
    expect(monthTemplate).toContain('bindpreviewchange="handleMonthWheelPreview"');
    expect(monthTemplate).toContain('bindsettle="handleYearWheelSettled"');
    expect(monthTemplate).toContain('bindsettle="handleMonthWheelSettled"');
    expect(monthTemplate).not.toContain('<scroll-view');
    expect(monthTemplate).not.toContain('scroll-top');
    expect(monthTemplate).not.toContain('bindscroll');
  });

  it('removes every legacy month-wheel owner from TypeScript and WXSS', () => {
    const controller = read('src/subpackages/workflows/components/workflow-picker/index.ts');
    const styles = read('src/subpackages/workflows/components/workflow-picker/index.wxss');

    for (const legacy of [
      'wheelIdleSnapMs',
      'wheelSnapAnimationMs',
      '_monthWheelLatestTop',
      '_monthWheelSnapTimer',
      '_monthWheelTouching',
      '_wheelAnimationKind',
      '_wheelAnimationTimer',
      '_yearWheelLatestTop',
      '_yearWheelSnapTimer',
      '_yearWheelTouching',
      'handleMonthWheelScroll',
      'handleYearWheelScroll',
      'scheduleWheelSnap',
      'snapWheel',
      'setWheelProgress',
      'createWheelItems',
      'wheelSnapAnimating',
    ]) {
      expect(controller).not.toContain(legacy);
    }
    expect(styles).not.toContain('scroll-snap-type');
    expect(styles).not.toContain('scroll-snap-align');
    expect(styles).not.toContain('.workflow-picker-wheel-item');
    expect(styles).not.toContain('.workflow-picker-wheel-spacer');
  });

  it('keeps generation, runtime and sequence ownership in the parent semantic boundary', () => {
    const controller = read('src/subpackages/workflows/components/workflow-picker/index.ts');
    expect(controller).toContain('wheelGeneration');
    expect(controller).toContain('yearWheelRuntimeKey');
    expect(controller).toContain('monthWheelRuntimeKey');
    expect(controller).toContain('_yearWheelSequence');
    expect(controller).toContain('_monthWheelSequence');
    expect(controller).toContain('handleYearWheelPreview');
    expect(controller).toContain('handleMonthWheelPreview');
    expect(controller).toContain('handleYearWheelSettled');
    expect(controller).toContain('handleMonthWheelSettled');
  });
});
