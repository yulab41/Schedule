import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  iconContextSpecs,
  iconMotionSpecs,
  miniProgramContextBindings,
  miniProgramMotionBindings,
  miniProgramReducedMotionSelectors,
  webContextBindings,
  webMotionBindings,
  webReducedMotionSelectors,
} from '../dist/index.js';

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageDirectory, '../..');
const outputPaths = {
  web: resolve(repositoryRoot, 'apps/web/src/generated/ui-icon-motion.css'),
  miniprogram: resolve(repositoryRoot, 'apps/miniprogram/src/styles/ui-icon-motion.wxss'),
};
const checkOnly = process.argv.slice(2).includes('--check');

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

function hash(value) {
  return createHash('sha256')
    .update(JSON.stringify(stableValue(value)))
    .digest('hex');
}

function cssNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function keyframeName(specKey, partKey) {
  return `ui-motion-${specKey}-${partKey}`.replaceAll(/[^a-z0-9-]/gu, '-');
}

function findPart(spec, partKey) {
  const part = spec.parts.find((candidate) => candidate.partKey === partKey);
  if (part === undefined) throw new Error(`Missing motion part ${spec.key}/${partKey}`);
  return part;
}

function renderContextBinding(binding) {
  const context = iconContextSpecs[binding.contextKey];
  const size = `${cssNumber(context.sizePx)}px`;
  const stroke = cssNumber(context.strokeWidth);
  if (binding.mode === 'action-variables') {
    return `${binding.selector} {\n  --action-motion-icon-size: ${size};\n  --action-motion-icon-stroke-width: ${stroke};\n}`;
  }
  const declarations = [`width: ${size};`, `height: ${size};`];
  if (binding.mode === 'svg-box') declarations.push(`stroke-width: ${stroke};`);
  return `${binding.selector} {\n${declarations.map((value) => `  ${value}`).join('\n')}\n}`;
}

function renderKeyframes(name, part, capability) {
  const frames = part.keyframes
    .map((frame) => {
      const declarations = [];
      if (frame.transform !== undefined) declarations.push(`transform: ${frame.transform};`);
      if (frame.opacity !== undefined) declarations.push(`opacity: ${cssNumber(frame.opacity)};`);
      if (frame.strokeDashoffset !== undefined && capability !== 'omit-stroke-dashoffset') {
        declarations.push(`stroke-dashoffset: ${cssNumber(frame.strokeDashoffset)};`);
      }
      const percent = `${cssNumber(frame.offset * 100)}%`;
      return `  ${percent} {\n${declarations.map((value) => `    ${value}`).join('\n')}\n  }`;
    })
    .join('\n');
  return `@keyframes ${name} {\n${frames}\n}`;
}

function renderMotionBinding(binding) {
  const spec = iconMotionSpecs[binding.specKey];
  const part = findPart(spec, binding.partKey);
  const name = keyframeName(binding.specKey, binding.partKey);
  const delayMs = spec.delayMs + (part.delayMs ?? 0);
  const declarations = [];
  if (binding.transformBox !== undefined) {
    declarations.push(`transform-box: ${binding.transformBox};`);
  }
  if (binding.transformOrigin !== undefined) {
    declarations.push(`transform-origin: ${binding.transformOrigin};`);
  }
  declarations.push(
    `animation: ${name} ${spec.durationMs}ms ${spec.easing} ${delayMs}ms ${spec.iterationCount} ${spec.direction} ${spec.fillMode};`,
  );
  return `${binding.selector} {\n${declarations.map((value) => `  ${value}`).join('\n')}\n}`;
}

function renderReducedMotion(selectors) {
  return `@media (prefers-reduced-motion: reduce) {\n${selectors
    .map((selector) => `  ${selector}`)
    .join(',\n')} {\n    animation: none !important;\n    transition: none !important;\n  }\n}`;
}

function renderAdapter(platform, contextBindings, motionBindings, reducedMotionSelectors) {
  const contextHash = hash(iconContextSpecs);
  const motionHash = hash(iconMotionSpecs);
  const bindingsHash = hash({ contextBindings, motionBindings, reducedMotionSelectors });
  const header = `/* generated:ui-icon-motion;platform:${platform};context:${contextHash};motion:${motionHash};bindings:${bindingsHash} */`;
  const press = iconMotionSpecs['navigation-press'];
  const pressPart = findPart(press, 'item');
  const pressedTransform = pressPart.keyframes.at(-1)?.transform;
  if (pressedTransform === undefined) throw new Error('navigation-press must end with a transform');
  const rootSelector = platform === 'web' ? ':root' : 'page';
  const pressVariables = `${rootSelector} {\n  --ui-icon-navigation-press-duration: ${press.durationMs}ms;\n  --ui-icon-navigation-press-transform: ${pressedTransform};\n}`;
  const platformPress =
    platform === 'miniprogram'
      ? `.bottom-nav-item {\n  transition: transform var(--ui-icon-navigation-press-duration) ${press.easing};\n}\n\n.bottom-nav-item.is-pressed {\n  transform: var(--ui-icon-navigation-press-transform);\n}`
      : '';

  const keyframes = new Map();
  for (const binding of motionBindings) {
    const spec = iconMotionSpecs[binding.specKey];
    const part = findPart(spec, binding.partKey);
    const name = keyframeName(binding.specKey, binding.partKey);
    const rendered = renderKeyframes(name, part, binding.capability);
    const previous = keyframes.get(name);
    if (previous !== undefined && previous !== rendered) {
      throw new Error(`Conflicting generated keyframes for ${name}`);
    }
    keyframes.set(name, rendered);
  }

  return [
    header,
    pressVariables,
    platformPress,
    ...contextBindings.map(renderContextBinding),
    ...motionBindings.map(renderMotionBinding),
    ...keyframes.values(),
    renderReducedMotion(reducedMotionSelectors),
    '',
  ]
    .filter((section) => section !== '')
    .join('\n\n');
}

const outputs = {
  web: renderAdapter('web', webContextBindings, webMotionBindings, webReducedMotionSelectors),
  miniprogram: renderAdapter(
    'miniprogram',
    miniProgramContextBindings,
    miniProgramMotionBindings,
    miniProgramReducedMotionSelectors,
  ),
};

if (checkOnly) {
  const differences = Object.entries(outputPaths)
    .filter(([platform, outputPath]) => {
      return !existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== outputs[platform];
    })
    .map(([platform]) => platform);
  if (differences.length > 0) {
    console.error(`[ui-icons] generated motion adapters differ: ${differences.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('[ui-icons] tracked Web/Mini motion adapters are current');
  }
} else {
  for (const [platform, outputPath] of Object.entries(outputPaths)) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, outputs[platform], 'utf8');
  }
  console.log('[ui-icons] generated Web and Mini motion adapters');
}
