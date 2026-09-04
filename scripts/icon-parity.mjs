/* global console, process */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const iconModule = await import(
  pathToFileURL(path.join(repositoryRoot, 'packages/ui-icons/dist/index.js')).href
);
const tokenModule = await import(
  pathToFileURL(path.join(repositoryRoot, 'packages/ui-tokens/dist/index.js')).href
);

const {
  iconCatalog,
  iconContextSpecs,
  iconMotionSpecs,
  iconParityMatrix,
  miniAssetEntries,
  miniProgramContextBindings,
  miniProgramMotionBindings,
  miniProgramReducedMotionSelectors,
  webContextBindings,
  webMotionBindings,
  webReducedMotionSelectors,
} = iconModule;
const { colorTokens } = tokenModule;
const iconColors = {
  danger: colorTokens.danger,
  directoryModeInactive: colorTokens.directoryModeInactive,
  favorite: colorTokens.warning,
  muted: colorTokens.textMuted,
  primary: colorTokens.primary,
  secondary: colorTokens.textSecondary,
  success: colorTokens.success,
};

const miniSourceRoot = path.join(repositoryRoot, 'apps/miniprogram/src');
const miniIconDirectory = path.join(miniSourceRoot, 'assets/icons');
const webSourceRoot = path.join(repositoryRoot, 'apps/web/src');
const webMotionPath = path.join(webSourceRoot, 'generated/ui-icon-motion.css');
const miniMotionPath = path.join(miniSourceRoot, 'styles/ui-icon-motion.wxss');
const allowlistPath = path.join(repositoryRoot, 'scripts/icon-parity-allowlist.json');
const errors = [];

function relativePath(absolutePath) {
  return path.relative(repositoryRoot, absolutePath).replaceAll('\\', '/');
}

function issue(message) {
  errors.push(message);
}

function walk(directory, extensions, result = []) {
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['.git', 'dist', 'node_modules', 'runtime'].includes(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolutePath, extensions, result);
    else if (entry.isFile() && extensions.has(path.extname(entry.name))) result.push(absolutePath);
  }
  return result.sort((left, right) => relativePath(left).localeCompare(relativePath(right), 'en'));
}

function lineNumber(source, index) {
  return source.slice(0, index).split(/\r?\n/u).length;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right, 'en'))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

function stableHash(value) {
  return sha256(JSON.stringify(stableValue(value)));
}

function cssNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function keyframeName(specKey, partKey) {
  return `ui-motion-${specKey}-${partKey}`.replaceAll(/[^a-z0-9-]/gu, '-');
}

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    issue(`missing file: ${relativePath(filePath)}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function parseAttributes(source) {
  const attributes = {};
  for (const match of source.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gu)) {
    attributes[match[1]] = match[3];
  }
  return attributes;
}

function parseSvgElements(source) {
  const elements = [];
  const stack = [];
  const pattern = /<\/g\s*>|<(g|path|circle|rect)\b([^>]*?)(\/?)>/gu;
  for (const match of source.matchAll(pattern)) {
    if (match[0].startsWith('</')) {
      if (stack.length === 0) issue('generated SVG has an unmatched group close tag');
      else stack.pop();
      continue;
    }
    const kind = match[1];
    const attributes = parseAttributes(match[2] ?? '');
    elements.push({ kind, depth: stack.length, attributes });
    if (kind === 'g' && match[3] !== '/') stack.push(kind);
  }
  if (stack.length !== 0) issue('generated SVG has an unclosed group');
  return elements;
}

function expectedSvgElements(nodes, depth = 0, result = []) {
  for (const node of nodes) {
    const attributes = {
      'data-part': node.part,
      ...(node.kind === 'path'
        ? {
            d: node.d,
            'fill-rule': node.fillRule,
            'clip-rule': node.clipRule,
            pathLength: node.pathLength,
          }
        : node.kind === 'circle'
          ? { cx: node.cx, cy: node.cy, r: node.r }
          : node.kind === 'rect'
            ? { x: node.x, y: node.y, width: node.width, height: node.height, rx: node.rx }
            : {}),
    };
    result.push({ kind: node.kind === 'group' ? 'g' : node.kind, depth, attributes });
    if (node.kind === 'group') expectedSvgElements(node.children, depth + 1, result);
  }
  return result;
}

function normalizedGeometryElement(element) {
  const attrs = element.attributes;
  const value = (name) => {
    const raw = attrs[name];
    if (raw === undefined) return undefined;
    if (
      name === 'pathLength' ||
      ['cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'rx'].includes(name)
    ) {
      return Number(raw);
    }
    return raw;
  };
  const names =
    element.kind === 'path'
      ? ['d', 'fill-rule', 'clip-rule', 'pathLength']
      : element.kind === 'circle'
        ? ['cx', 'cy', 'r']
        : element.kind === 'rect'
          ? ['x', 'y', 'width', 'height', 'rx']
          : [];
  return {
    kind: element.kind,
    part: attrs['data-part'],
    geometry: Object.fromEntries(
      names.filter((name) => value(name) !== undefined).map((name) => [name, value(name)]),
    ),
  };
}

function geometryList(elements) {
  return elements.map((element) => ({
    depth: element.depth,
    ...normalizedGeometryElement(element),
  }));
}

function collectPartHashes(elements) {
  const byPart = new Map();
  for (const element of elements) {
    const part = element.attributes['data-part'];
    if (part === undefined) continue;
    const values = byPart.get(part) ?? [];
    values.push(normalizedGeometryElement(element));
    byPart.set(part, values);
  }
  return new Map(
    [...byPart.entries()].map(([part, values]) => [part, sha256(JSON.stringify(values))]),
  );
}

function rootSvgAttributes(source) {
  const match = source.match(/<svg\b([^>]*)>/u);
  return match === null ? {} : parseAttributes(match[1]);
}

function expectedColorRole(entry) {
  if (entry.contextKey === undefined) return entry.colorRole;
  const context = iconContextSpecs[entry.contextKey];
  return entry.tone === 'inactive' ? context.inactiveColorRole : context.activeColorRole;
}

function expectedStrokeWidth(entry, definition) {
  if (entry.contextKey === undefined) return entry.strokeWidth ?? definition.strokeWidth;
  return iconContextSpecs[entry.contextKey].strokeWidth;
}

function checkGeneratedAsset(entry, expectedFileSet) {
  const definition = iconCatalog[entry.sourceKey];
  if (definition === undefined) {
    issue(`manifest source missing from canonical catalog: ${entry.fileKey} -> ${entry.sourceKey}`);
    return;
  }
  const fileName = `ui-${entry.fileKey}.svg`;
  if (!expectedFileSet.has(fileName)) {
    issue(`manifest file missing: ${fileName}`);
    return;
  }
  const filePath = path.join(miniIconDirectory, fileName);
  const source = readText(filePath);
  const marker = source.match(
    /generated:ui-icons;source:([^;]+);content:([0-9a-f]{64})(?:;context:([^\s]+))?/u,
  );
  if (marker === null) {
    issue(`generated marker missing: ${relativePath(filePath)}`);
  } else {
    const expectedContent = sha256(JSON.stringify(definition.nodes));
    if (marker[1] !== definition.sourceSha) issue(`source SHA marker mismatch: ${fileName}`);
    if (marker[2] !== expectedContent) issue(`geometry content marker mismatch: ${fileName}`);
    if ((marker[3] ?? undefined) !== (entry.contextKey ?? undefined)) {
      issue(`context marker mismatch: ${fileName}`);
    }
  }

  const attrs = rootSvgAttributes(source);
  const role = expectedColorRole(entry);
  const expectedColor = iconColors[role];
  const expectedStroke = cssNumber(expectedStrokeWidth(entry, definition));
  const expectedRoot = {
    viewBox: definition.viewBox,
    fill: 'none',
    stroke: expectedColor,
    'stroke-width': expectedStroke,
    'stroke-linecap': definition.lineCap,
    'stroke-linejoin': definition.lineJoin,
  };
  for (const [name, expected] of Object.entries(expectedRoot)) {
    if (attrs[name] !== expected) issue(`SVG context mismatch ${name}: ${fileName}`);
  }

  const actualElements = parseSvgElements(source);
  const expectedElements = expectedSvgElements(definition.nodes);
  if (
    JSON.stringify(geometryList(actualElements)) !== JSON.stringify(geometryList(expectedElements))
  ) {
    issue(`normalized SVG geometry mismatch: ${fileName}`);
  }
  const expectedParts = new Set(
    expectedElements
      .map((element) => element.attributes['data-part'])
      .filter((part) => part !== undefined),
  );
  const actualParts = new Set(
    actualElements
      .map((element) => element.attributes['data-part'])
      .filter((part) => part !== undefined),
  );
  if (JSON.stringify([...actualParts].sort()) !== JSON.stringify([...expectedParts].sort())) {
    issue(`SVG part set mismatch: ${fileName}`);
  }
  if (expectedParts.size > 1) {
    const expectedHashes = collectPartHashes(expectedElements);
    const actualHashes = collectPartHashes(actualElements);
    for (const part of expectedParts) {
      if (actualHashes.get(part) !== expectedHashes.get(part)) {
        issue(`SVG part geometry mismatch: ${fileName}#${part}`);
      }
    }
  }
}

function checkMiniInventory() {
  const sourceFiles = walk(miniSourceRoot, new Set(['.wxml', '.wxss', '.ts']));
  const references = [];
  const referencesByFile = new Map();
  let legacyReferenceCount = 0;
  for (const filePath of sourceFiles) {
    const source = fs.readFileSync(filePath, 'utf8');
    for (const match of source.matchAll(/\/assets\/icons\/([A-Za-z0-9_-]+\.svg)/gu)) {
      const fileName = match[1];
      references.push({ fileName, filePath, line: lineNumber(source, match.index) });
      referencesByFile.set(fileName, (referencesByFile.get(fileName) ?? 0) + 1);
      const target = path.join(miniIconDirectory, fileName);
      if (!fs.existsSync(target)) {
        issue(
          `icon reference points to missing file: ${relativePath(filePath)}:${lineNumber(source, match.index)} -> ${fileName}`,
        );
      }
      if (!fileName.startsWith('ui-')) {
        issue(
          `non-canonical icon reference: ${relativePath(filePath)}:${lineNumber(source, match.index)} -> ${fileName}`,
        );
      }
    }
    const legacyMatches = [...source.matchAll(/\bweb-[A-Za-z0-9_-]+\.svg\b/giu)];
    legacyReferenceCount += legacyMatches.length;
    for (const match of legacyMatches) {
      issue(
        `legacy web icon reference: ${relativePath(filePath)}:${lineNumber(source, match.index)}`,
      );
    }
  }

  const actualSvgFiles = fs.existsSync(miniIconDirectory)
    ? fs
        .readdirSync(miniIconDirectory)
        .filter((fileName) => fileName.endsWith('.svg'))
        .sort()
    : [];
  const expectedSvgFiles = miniAssetEntries.map((entry) => `ui-${entry.fileKey}.svg`).sort();
  if (JSON.stringify(actualSvgFiles) !== JSON.stringify(expectedSvgFiles)) {
    issue('generated manifest and Mini SVG directory are not bidirectionally closed');
  }
  const expectedFileSet = new Set(expectedSvgFiles);
  for (const entry of miniAssetEntries) checkGeneratedAsset(entry, expectedFileSet);
  const unreferencedFiles = expectedSvgFiles.filter(
    (fileName) => (referencesByFile.get(fileName) ?? 0) === 0,
  );
  for (const fileName of unreferencedFiles)
    issue(`generated Mini asset is not consumed: ${fileName}`);

  return {
    sourceFileCount: sourceFiles.length,
    referenceCount: references.length,
    uniqueReferenceCount: referencesByFile.size,
    referencesByFile: Object.fromEntries([...referencesByFile.entries()].sort()),
    legacyReferenceCount,
    legacyAssetFileCount: actualSvgFiles.filter((fileName) => fileName.startsWith('web-')).length,
    generatedAssetCount: actualSvgFiles.length,
    unreferencedAssetCount: unreferencedFiles.length,
  };
}

function loadAllowlist() {
  if (!fs.existsSync(allowlistPath)) return [];
  const value = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
  return Array.isArray(value) ? value : [];
}

function allowedPath(filePath, allowlist) {
  const normalized = relativePath(filePath);
  return allowlist.some((entry) => entry.path === normalized);
}

function checkWebInventory() {
  const allowlist = loadAllowlist();
  const files = walk(webSourceRoot, new Set(['.vue', '.ts']));
  const productionFiles = files.filter(
    (filePath) => !relativePath(filePath).includes('/stories/') && !filePath.endsWith('.spec.ts'),
  );
  const privateIconFiles = [];
  let directTdesignReferences = 0;
  for (const filePath of productionFiles) {
    const source = fs.readFileSync(filePath, 'utf8');
    if (source.includes('tdesign-icons-vue-next')) {
      directTdesignReferences += 1;
      issue(
        `production Web code imports the upstream icon package directly: ${relativePath(filePath)}`,
      );
    }
    if (/<svg\b|data:image\/svg\+xml|(?:mask|background-image)\s*:[^;]*url\(/iu.test(source)) {
      privateIconFiles.push(relativePath(filePath));
      if (!allowedPath(filePath, allowlist)) {
        issue(`private hand-drawn Web icon outside allowlist: ${relativePath(filePath)}`);
      }
    }
    if (/--action-motion-icon-(?:size|stroke-width)\s*:\s*[0-9.]+px/iu.test(source)) {
      issue(
        `Web action icon context is hard-coded outside generated adapter: ${relativePath(filePath)}`,
      );
    }
  }
  const sharedIconSource = readText(path.join(webSourceRoot, 'components/SharedIcon.vue'));
  if (!sharedIconSource.includes("from '@schedule/ui-icons'")) {
    issue('SharedIcon.vue is not backed by @schedule/ui-icons');
  }
  if (!sharedIconSource.includes('iconCatalog'))
    issue('SharedIcon.vue does not read the canonical catalog');
  return {
    productionFileCount: productionFiles.length,
    privateIconFiles,
    directTdesignReferences,
    allowlistedPrivateIconCount: privateIconFiles.filter((filePath) =>
      allowlist.some((entry) => entry.path === filePath),
    ).length,
  };
}

function checkContextMatrix() {
  const catalogKeys = new Set(Object.keys(iconCatalog));
  const entryByFile = new Map(miniAssetEntries.map((entry) => [entry.fileKey, entry]));
  const matrixFiles = new Set();
  for (const row of iconParityMatrix) {
    if (matrixFiles.has(row.fileKey)) issue(`duplicate icon parity matrix row: ${row.fileKey}`);
    matrixFiles.add(row.fileKey);
    const entry = entryByFile.get(row.fileKey);
    if (entry === undefined) {
      issue(`icon parity matrix row has no generator manifest entry: ${row.fileKey}`);
      continue;
    }
    if (!catalogKeys.has(row.sourceKey)) issue(`matrix source is not canonical: ${row.fileKey}`);
    const expectedContext = entry.contextKey ?? 'static-action';
    if (row.contextKey !== expectedContext) issue(`matrix context mismatch: ${row.fileKey}`);
    const context = iconContextSpecs[row.contextKey];
    if (context === undefined) {
      issue(`matrix context is undefined: ${row.fileKey} -> ${row.contextKey}`);
      continue;
    }
    if (
      context.sizePx === 24 ||
      context.containerWidthPx === 24 ||
      context.containerHeightPx === 24
    ) {
      issue(`24px context is forbidden for production icon parity: ${row.contextKey}`);
    }
    if (
      context.sizePx !== context.containerWidthPx ||
      context.sizePx !== context.containerHeightPx
    ) {
      issue(`context size/container drift: ${row.contextKey}`);
    }
    if (
      !Array.isArray(context.opticalOffset) ||
      context.opticalOffset.length !== 2 ||
      context.opticalOffset.some((value) => !Number.isFinite(value)) ||
      context.transformOrigin.length === 0
    ) {
      issue(`context geometry contract incomplete: ${row.contextKey}`);
    }
    if (row.semantic.trim().length === 0) issue(`empty icon semantic: ${row.fileKey}`);
    const hasTone = entry.tone !== undefined;
    if (hasTone && row.states[entry.tone] !== 'asset') {
      issue(`state matrix does not provide the declared ${entry.tone} asset: ${row.fileKey}`);
    }
    if (!hasTone && Object.values(row.states).some((coverage) => coverage !== 'not-applicable')) {
      issue(`static icon state matrix is implicit instead of explicit: ${row.fileKey}`);
    }
    if (row.motionKey !== undefined && iconMotionSpecs[row.motionKey] === undefined) {
      issue(`matrix motion source is undefined: ${row.fileKey} -> ${row.motionKey}`);
    }
  }
  if (matrixFiles.size !== miniAssetEntries.length)
    issue('semantic-context-state matrix is not complete');

  const groupedStates = new Map();
  for (const entry of miniAssetEntries) {
    if (entry.tone === undefined) continue;
    const key = `${entry.sourceKey}|${entry.contextKey}|${iconParityMatrix.find((row) => row.fileKey === entry.fileKey)?.semantic}`;
    const states = groupedStates.get(key) ?? new Set();
    states.add(entry.tone);
    groupedStates.set(key, states);
  }
  for (const [key, states] of groupedStates) {
    if (states.has('active') && states.has('inactive')) continue;
    const rows = iconParityMatrix.filter((row) =>
      key.startsWith(`${row.sourceKey}|${row.contextKey}|`),
    );
    if (rows.some((row) => row.states.inactive === 'asset' && !states.has('inactive'))) {
      issue(`inactive state claims an asset but has no generated variant: ${key}`);
    }
  }
  return {
    matrixEntryCount: iconParityMatrix.length,
    contextCount: Object.keys(iconContextSpecs).length,
    statefulGroups: [...groupedStates.values()].filter((states) => states.size > 1).length,
  };
}

function checkMotionSources() {
  const webMotion = readText(webMotionPath);
  const miniMotion = readText(miniMotionPath);
  const expectedContextHash = stableHash(iconContextSpecs);
  const expectedMotionHash = stableHash(iconMotionSpecs);
  const expectedWebBindingsHash = stableHash({
    contextBindings: webContextBindings,
    motionBindings: webMotionBindings,
    reducedMotionSelectors: webReducedMotionSelectors,
  });
  const expectedMiniBindingsHash = stableHash({
    contextBindings: miniProgramContextBindings,
    motionBindings: miniProgramMotionBindings,
    reducedMotionSelectors: miniProgramReducedMotionSelectors,
  });
  const webHeader = webMotion.match(
    /generated:ui-icon-motion;platform:web;context:([^;]+);motion:([^;]+);bindings:([^\s*]+)/u,
  );
  const miniHeader = miniMotion.match(
    /generated:ui-icon-motion;platform:miniprogram;context:([^;]+);motion:([^;]+);bindings:([^\s*]+)/u,
  );
  for (const [name, header, bindingsHash] of [
    ['Web', webHeader, expectedWebBindingsHash],
    ['Mini', miniHeader, expectedMiniBindingsHash],
  ]) {
    if (header === null) {
      issue(`${name} motion adapter header missing`);
      continue;
    }
    if (
      header[1] !== expectedContextHash ||
      header[2] !== expectedMotionHash ||
      header[3] !== bindingsHash
    ) {
      issue(`${name} motion adapter is not generated from the current shared motion source`);
    }
  }

  for (const [platform, bindings, output] of [
    ['Web', webContextBindings, webMotion],
    ['Mini', miniProgramContextBindings, miniMotion],
  ]) {
    for (const binding of bindings) {
      if (!output.includes(binding.selector))
        issue(`${platform} context binding is not emitted: ${binding.selector}`);
    }
  }
  const allBindings = [
    ['Web', webMotionBindings, webMotion],
    ['Mini', miniProgramMotionBindings, miniMotion],
  ];
  let motionBindingCount = 0;
  for (const [platform, bindings, output] of allBindings) {
    for (const binding of bindings) {
      const name = keyframeName(binding.specKey, binding.partKey);
      if (!output.includes(`@keyframes ${name}`) || !output.includes(`animation: ${name} `)) {
        issue(`${platform} motion binding is not emitted/consumed: ${name}`);
      }
      const spec = iconMotionSpecs[binding.specKey];
      if (spec === undefined || !spec.parts.some((part) => part.partKey === binding.partKey)) {
        issue(`${platform} motion binding points to a missing motion part: ${name}`);
      }
      motionBindingCount += 1;
    }
  }
  for (const [platform, output] of [
    ['Web', webMotion],
    ['Mini', miniMotion],
  ]) {
    for (const match of output.matchAll(/@keyframes\s+([a-z0-9-]+)/gu)) {
      if (!output.includes(`animation: ${match[1]} `))
        issue(`${platform} orphan keyframes: ${match[1]}`);
    }
  }

  const workbenchWxml = readText(path.join(miniSourceRoot, 'pages/workbench/index.wxml'));
  const workbenchTs = readText(path.join(miniSourceRoot, 'pages/workbench/index.ts'));
  for (const workspace of ['calendar', 'directory', 'swap', 'profile', 'more']) {
    const activeLoop = `activeWorkspace === '${workspace}' ? 'is-looping' : ''`;
    if (!workbenchWxml.includes(activeLoop))
      issue(`Mini bottom navigation loop is not bound to active ${workspace}`);
  }
  if (!workbenchTs.includes('activeWorkspace: workspace'))
    issue('Mini active workspace setter is missing');
  if (workbenchWxml.includes('class="nav-icon is-looping"')) {
    issue('Mini bottom navigation contains an unconditional looping class');
  }
  if (
    !webMotion.includes('.icon-bell .is-animating') ||
    webMotion.includes('.is-looping.icon-bell ')
  ) {
    issue('top bell one-shot motion was conflated with the looping navigation motion');
  }
  return {
    webContextBindingCount: webContextBindings.length,
    miniContextBindingCount: miniProgramContextBindings.length,
    webMotionBindingCount: webMotionBindings.length,
    miniMotionBindingCount: miniProgramMotionBindings.length,
    emittedMotionBindingCount: motionBindingCount,
  };
}

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return source.length;
}

function withoutRanges(source, ranges) {
  let result = '';
  let cursor = 0;
  for (const [start, end] of ranges.sort(([left], [right]) => left - right)) {
    result += source.slice(cursor, start);
    cursor = end;
  }
  return result + source.slice(cursor);
}

function checkMiniKeyframeLiveness() {
  const records = [];
  for (const filePath of walk(miniSourceRoot, new Set(['.wxss']))) {
    const source = fs.readFileSync(filePath, 'utf8');
    const ranges = [];
    for (const match of source.matchAll(/@(?:-webkit-)?keyframes\s+([\w-]+)\s*\{/gu)) {
      const openIndex = (match.index ?? 0) + match[0].lastIndexOf('{');
      const end = findMatchingBrace(source, openIndex);
      ranges.push([match.index ?? 0, end]);
      records.push({ filePath, name: match[1], sourceWithoutDefinition: null, ranges });
    }
    const sourceWithoutDefinitions = withoutRanges(source, ranges);
    for (const record of records.filter((candidate) => candidate.filePath === filePath)) {
      record.sourceWithoutDefinition = sourceWithoutDefinitions;
    }
  }
  let orphanCount = 0;
  for (const record of records) {
    const uses = new RegExp(
      `(?:^|[;{\\s])animation(?:-name)?\\s*:[^;{}]*\\b${record.name}\\b`,
      'u',
    ).test(record.sourceWithoutDefinition ?? '');
    if (!uses) {
      orphanCount += 1;
      issue(`orphan Mini keyframes: ${record.name} @ ${relativePath(record.filePath)}`);
    }
  }
  return {
    miniKeyframeDefinitionCount: records.length,
    orphanMiniKeyframeCount: orphanCount,
  };
}

function checkCatalogContract() {
  for (const [key, definition] of Object.entries(iconCatalog)) {
    if (definition.viewBox !== '0 0 24 24') issue(`catalog viewBox drift: ${key}`);
    if (!Number.isFinite(definition.strokeWidth) || definition.strokeWidth <= 0) {
      issue(`catalog stroke width invalid: ${key}`);
    }
    if (definition.nodes.length === 0) issue(`catalog icon has no geometry: ${key}`);
    if (definition.sourceSha.trim().length === 0 || definition.sourceRef.trim().length === 0) {
      issue(`catalog provenance missing: ${key}`);
    }
    for (const node of expectedSvgElements(definition.nodes)) {
      if (node.kind === 'path' && node.attributes.d.length === 0)
        issue(`empty path geometry: ${key}`);
    }
  }
  return { catalogCount: Object.keys(iconCatalog).length };
}

const metrics = {
  ...checkCatalogContract(),
  ...checkMiniInventory(),
  ...checkWebInventory(),
  ...checkContextMatrix(),
  ...checkMotionSources(),
  ...checkMiniKeyframeLiveness(),
};

const result = {
  ok: errors.length === 0,
  metrics,
  errors: [...new Set(errors)].sort(),
};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
