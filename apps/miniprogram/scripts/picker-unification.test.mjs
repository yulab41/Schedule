import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function sourceFiles(directory, extension) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute, extension);
    return entry.isFile() && entry.name.endsWith(extension) ? [absolute] : [];
  });
}

function occurrences(source, token) {
  return source.split(token).length - 1;
}

describe('shared picker unification', () => {
  it('keeps selector padding inside the scroll content instead of the rounded viewport', () => {
    const template = read('components/ui/ui-selector/options.wxml');
    const styles = read('components/ui/ui-selector/index.wxss');

    expect(template).toMatch(
      /<scroll-view[^>]*workflow-picker-selector-popover[\s\S]*?<view class="workflow-picker-selector-content">[\s\S]*?workflow-picker-option[\s\S]*?<\/view>\s*<\/scroll-view>/u,
    );
    expect(styles).toMatch(
      /\.workflow-picker-selector-content\s*\{[^}]*padding:\s*6px;[^}]*box-sizing:\s*border-box;/su,
    );
    expect(styles).not.toMatch(/\.workflow-picker-selector-popover\s*\{[^}]*padding:\s*6px;/su);
    expect(styles).toMatch(
      /\.workflow-picker-selector-popover\s*\{[^}]*overflow:\s*hidden;[^}]*border-radius:\s*10px;/su,
    );
  });

  it('keeps optional row actions separate and truncates long labels to one line', () => {
    const template = read('components/ui/ui-selector/options.wxml');
    const styles = read('components/ui/ui-selector/index.wxss');
    expect(template).toContain('catchtap="handleOptionActionTap"');
    expect(template).toContain('{{item.actionLabel}}');
    expect(styles).toMatch(
      /\.workflow-picker-option-label\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/su,
    );
    expect(styles).toMatch(/\.workflow-picker-option-action\s*\{[^}]*border-radius:/su);
  });

  it('removes native pickers and routes every migrated field through shared components', () => {
    const wxml = sourceFiles(root, '.wxml')
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    expect(wxml).not.toContain('<picker');

    const qrVisitor = read('subpackages/organization/components/qr-visitor-panel/index.wxml');
    expect(occurrences(qrVisitor, '<ui-selector')).toBe(1);
    expect(occurrences(qrVisitor, 'placement-boundary="{{pickerBoundary}}"')).toBe(1);

    const backfill = read('subpackages/scheduling/pages/backfill/index.wxml');
    expect(occurrences(backfill, '<ui-selector')).toBe(1);
    expect(backfill).toContain('placement-boundary="{{pickerBoundary}}"');

    const diagnostics = read('subpackages/diagnostics/pages/test-tools/index.wxml');
    expect(occurrences(diagnostics, '<ui-selector')).toBe(1);

    const scheduling = read(
      'subpackages/organization/components/scheduling-config-panel/index.wxml',
    );
    expect(occurrences(scheduling, 'mode="time"')).toBe(4);

    expect(
      JSON.parse(read('subpackages/organization/pages/qr-visitor/index.json')).usingComponents[
        'ui-selector'
      ],
    ).toBe('/components/ui/ui-selector/index');
    expect(
      JSON.parse(read('subpackages/organization/pages/scheduling-config/index.json'))
        .usingComponents['ui-date-picker'],
    ).toBe('/components/ui/ui-date-picker/index');
  });

  it('passes a local scroll boundary to every page-level shared list selector', () => {
    const contracts = [
      ['subpackages/scheduling/pages/manual/index.wxml', 3],
      ['subpackages/insights/components/exports-panel/index.wxml', 3],
      ['subpackages/organization/components/group-settings-panel/index.wxml', 4],
      ['subpackages/organization/components/qr-visitor-panel/index.wxml', 1],
      ['subpackages/scheduling/pages/backfill/index.wxml', 1],
    ];

    for (const [file, selectorCount] of contracts) {
      const template = read(file);
      expect(occurrences(template, '<ui-selector'), file).toBe(selectorCount);
      expect(occurrences(template, 'placement-boundary="{{pickerBoundary}}"'), file).toBe(
        selectorCount,
      );
      expect(template, file).toContain('bindpickerrequestopen="handlePickerRequestOpen"');
    }
  });

  it('keeps the application renderer pinned to WebView', () => {
    const app = JSON.parse(read('app.json'));
    expect(app.renderer).toBe('webview');
    expect(app).not.toHaveProperty('rendererOptions');
  });
});
