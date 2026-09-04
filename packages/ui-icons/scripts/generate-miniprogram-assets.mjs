import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { colorTokens } from '@schedule/ui-tokens';
import { iconCatalog, iconContextSpecs, miniAssetEntries } from '../dist/index.js';

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(packageDirectory, '../../apps/miniprogram/src/assets/icons');
const checkOnly = process.argv.slice(2).includes('--check');
const colors = {
  danger: colorTokens.danger,
  directoryModeInactive: colorTokens.directoryModeInactive,
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

function resolveEntryStyle(entry) {
  if (entry.contextKey === undefined) {
    return {
      colorRole: entry.colorRole,
      strokeWidth: entry.strokeWidth,
    };
  }
  const context = iconContextSpecs[entry.contextKey];
  const colorRole = entry.tone === 'inactive' ? context.inactiveColorRole : context.activeColorRole;
  return {
    colorRole,
    contextKey: context.key,
    strokeWidth: context.strokeWidth,
  };
}

const expectedFiles = new Map();
for (const entry of miniAssetEntries) {
  const definition = iconCatalog[entry.sourceKey];
  const style = resolveEntryStyle(entry);
  const color = colors[style.colorRole];
  const contentHash = createHash('sha256').update(JSON.stringify(definition.nodes)).digest('hex');
  const source =
    style.contextKey === undefined
      ? `<!-- generated:ui-icons;source:${definition.sourceSha};content:${contentHash} -->`
      : `<!-- generated:ui-icons;source:${definition.sourceSha};content:${contentHash};context:${style.contextKey} -->`;
  const svg = [
    source,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${definition.viewBox}" fill="none" stroke="${color}" stroke-width="${style.strokeWidth ?? definition.strokeWidth}" stroke-linecap="${definition.lineCap}" stroke-linejoin="${definition.lineJoin}">`,
    definition.nodes.map((node) => renderNode(node, color)).join(''),
    '</svg>',
    '',
  ].join('\n');
  const fileName = `ui-${entry.fileKey}.svg`;
  expectedFiles.set(fileName, svg);
}

if (checkOnly) {
  const differences = [];
  for (const [fileName, expected] of expectedFiles) {
    const filePath = resolve(outputDirectory, fileName);
    if (!existsSync(filePath) || readFileSync(filePath, 'utf8') !== expected) {
      differences.push(fileName);
    }
  }
  if (existsSync(outputDirectory)) {
    for (const fileName of readdirSync(outputDirectory)) {
      if (
        !fileName.startsWith('ui-') ||
        !fileName.endsWith('.svg') ||
        expectedFiles.has(fileName)
      ) {
        continue;
      }
      const existing = readFileSync(resolve(outputDirectory, fileName), 'utf8');
      if (existing.includes('generated:ui-icons')) differences.push(fileName);
    }
  }
  if (differences.length > 0) {
    console.error(
      `[ui-icons] generated assets differ: ${[...new Set(differences)].sort().join(', ')}`,
    );
    process.exitCode = 1;
  } else {
    console.log(`[ui-icons] ${expectedFiles.size} tracked Mini SVG assets are current`);
  }
} else {
  mkdirSync(outputDirectory, { recursive: true });
  for (const [fileName, svg] of expectedFiles) {
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
  console.log(`[ui-icons] generated ${expectedFiles.size} Mini SVG assets in ${outputDirectory}`);
}
