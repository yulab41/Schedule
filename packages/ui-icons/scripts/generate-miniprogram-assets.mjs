import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { colorTokens } from '@schedule/ui-tokens';
import { iconCatalog, miniAssetEntries } from '../dist/index.js';

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(packageDirectory, '../../apps/miniprogram/src/assets/icons');
const colors = {
  danger: colorTokens.danger,
  favorite: colorTokens.warning,
  muted: colorTokens.textMuted,
  primary: colorTokens.primary,
  secondary: colorTokens.textSecondary,
  success: colorTokens.success,
};

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function paint(value, fallback) {
  if (value === 'currentColor') return fallback;
  return value ?? undefined;
}

function renderNode(node, color) {
  if (node.kind === 'group') {
    const part = node.part === undefined ? '' : ` data-part="${escapeAttribute(node.part)}"`;
    return `<g${part}>${node.children.map((child) => renderNode(child, color)).join('')}</g>`;
  }

  const attrs = [];
  if (node.part !== undefined) attrs.push(`data-part="${escapeAttribute(node.part)}"`);
  if (node.kind === 'path') {
    attrs.push(`d="${escapeAttribute(node.d)}"`);
    if (node.pathLength !== undefined) attrs.push(`pathLength="${node.pathLength}"`);
    if (node.fill !== undefined) attrs.push(`fill="${escapeAttribute(paint(node.fill, color))}"`);
    if (node.stroke !== undefined)
      attrs.push(`stroke="${escapeAttribute(paint(node.stroke, color))}"`);
    if (node.fillRule !== undefined) attrs.push(`fill-rule="${node.fillRule}"`);
    if (node.clipRule !== undefined) attrs.push(`clip-rule="${node.clipRule}"`);
    return `<path ${attrs.join(' ')} />`;
  }

  if (node.kind === 'circle') {
    attrs.push(`cx="${node.cx}"`, `cy="${node.cy}"`, `r="${node.r}"`);
    if (node.fill !== undefined) attrs.push(`fill="${escapeAttribute(paint(node.fill, color))}"`);
    if (node.stroke !== undefined)
      attrs.push(`stroke="${escapeAttribute(paint(node.stroke, color))}"`);
    return `<circle ${attrs.join(' ')} />`;
  }

  attrs.push(`x="${node.x}"`, `y="${node.y}"`, `width="${node.width}"`, `height="${node.height}"`);
  if (node.rx !== undefined) attrs.push(`rx="${node.rx}"`);
  if (node.fill !== undefined) attrs.push(`fill="${escapeAttribute(paint(node.fill, color))}"`);
  if (node.stroke !== undefined)
    attrs.push(`stroke="${escapeAttribute(paint(node.stroke, color))}"`);
  return `<rect ${attrs.join(' ')} />`;
}

mkdirSync(outputDirectory, { recursive: true });
const expectedFiles = new Set();
for (const entry of miniAssetEntries) {
  const definition = iconCatalog[entry.sourceKey];
  const color = colors[entry.colorRole];
  const contentHash = createHash('sha256').update(JSON.stringify(definition.nodes)).digest('hex');
  const source = `<!-- generated:ui-icons;source:${definition.sourceSha};content:${contentHash} -->`;
  const svg = [
    source,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${definition.viewBox}" fill="none" stroke="${color}" stroke-width="${definition.strokeWidth}" stroke-linecap="${definition.lineCap}" stroke-linejoin="${definition.lineJoin}">`,
    definition.nodes.map((node) => renderNode(node, color)).join(''),
    '</svg>',
    '',
  ].join('\n');
  const fileName = `ui-${entry.fileKey}.svg`;
  expectedFiles.add(fileName);
  writeFileSync(resolve(outputDirectory, fileName), svg, 'utf8');
}

for (const fileName of readdirSync(outputDirectory)) {
  if (!fileName.startsWith('ui-') || !fileName.endsWith('.svg') || expectedFiles.has(fileName)) {
    continue;
  }
  const filePath = resolve(outputDirectory, fileName);
  const existing = readFileSync(filePath, 'utf8');
  if (existing.includes('generated:ui-icons')) unlinkSync(filePath);
}

console.log(
  `[ui-icons] generated ${miniAssetEntries.length} Mini SVG assets in ${outputDirectory}`,
);
