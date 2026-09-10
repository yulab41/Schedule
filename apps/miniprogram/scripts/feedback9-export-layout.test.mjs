import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const root = new URL('../src/subpackages/insights/', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');

describe('feedback9 export result layout', () => {
  it('uses one transient toast and independent download/share buttons registered on the page', () => {
    const template = read('components/exports-panel/index.wxml');
    expect(template).toContain('<ui-toast');
    expect(template).not.toContain('title="导出任务未完成"');
    expect(template).not.toContain('导出已完成');
    expect(template).toContain('bindpress="handleShare"');
    expect(template).toContain('class="ready-actions"');
    expect(template).toContain("state === 'download_failed'");
    expect(JSON.parse(read('pages/exports/index.json')).usingComponents['ui-toast']).toBe(
      '/components/ui/ui-toast/index',
    );
  });

  it('gives filenames a full separate row and equal compact button padding', () => {
    const styles = read('components/exports-panel/index.wxss');
    const dom = new JSDOM(
      `<style>${styles}</style><div class="exports-page"><div class="ready-result"><div class="ready-heading"><span class="ready-file">schedule-export-2026-09.csv</span></div><div class="ready-actions"><div class="ui-button">发送文件</div></div></div></div>`,
    );
    const style = (selector) =>
      dom.window.getComputedStyle(dom.window.document.querySelector(selector));
    expect(style('.ready-result').flexDirection).toBe('column');
    expect(style('.ready-file').whiteSpace).toBe('normal');
    expect(style('.ready-file').overflowWrap).toBe('anywhere');
    expect(style('.ready-actions').flexWrap).toBe('wrap');
    expect(style('.ui-button').lineHeight).toBe('1.4');
    for (const edge of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'])
      expect(style('.ui-button')[edge]).toBe('8px');
    dom.window.close();
  });
});
