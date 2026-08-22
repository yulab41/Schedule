import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PNG } from 'pngjs';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');
const ARTIFACT_ROOT = path.join(APP_ROOT, '.artifacts');
const GEOMETRY_PROPERTIES = ['x', 'y', 'width', 'height'];
const APPROVED_MASK_REASONS = [
  /^approved-native-/,
  /^font-raster-/,
  /^safe-area-/,
  /^status-bar-/,
  /^system-clock-/,
  /^system-keyboard-/,
];

export const VISUAL_THRESHOLDS = Object.freeze({
  maxKeyGeometryDeltaPx: 2,
  significantPixelRatio: 0.02,
  stableRegionSimilarity: 0.98,
});

const SIGNIFICANT_COLOR_DELTA = 24;

function roundMetric(value) {
  return Number(value.toFixed(6));
}

function isInsidePath(parentPath, candidatePath) {
  const relativePath = path.relative(parentPath, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function requireFiniteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
}

function validateImage(image, label) {
  if (
    !image ||
    !Number.isInteger(image.width) ||
    !Number.isInteger(image.height) ||
    !(image.data instanceof Uint8Array) ||
    image.data.length !== image.width * image.height * 4
  ) {
    throw new Error(`${label} must be a decoded RGBA PNG image.`);
  }
}

function validateMask(mask, width, height) {
  if (!mask || mask.width !== width || mask.height !== height) {
    throw new Error('Mask dimensions must match the compared images.');
  }
  if (typeof mask.version !== 'string' || mask.version.trim() === '') {
    throw new Error('Mask version is required.');
  }
  if (!Array.isArray(mask.regions)) {
    throw new Error('Mask regions must be an array.');
  }

  const masked = new Uint8Array(width * height);
  for (const [index, region] of mask.regions.entries()) {
    const prefix = `Mask region ${index}`;
    const x = requireFiniteNumber(region.x, `${prefix}.x`);
    const y = requireFiniteNumber(region.y, `${prefix}.y`);
    const regionWidth = requireFiniteNumber(region.width, `${prefix}.width`);
    const regionHeight = requireFiniteNumber(region.height, `${prefix}.height`);
    if (
      ![x, y, regionWidth, regionHeight].every(Number.isInteger) ||
      x < 0 ||
      y < 0 ||
      regionWidth <= 0 ||
      regionHeight <= 0 ||
      x + regionWidth > width ||
      y + regionHeight > height
    ) {
      throw new Error(`${prefix} lies outside the image or has invalid dimensions.`);
    }
    if (
      typeof region.reason !== 'string' ||
      !APPROVED_MASK_REASONS.some((pattern) => pattern.test(region.reason))
    ) {
      throw new Error(`${prefix} reason is not an approved dynamic native region.`);
    }

    for (let row = y; row < y + regionHeight; row += 1) {
      masked.fill(1, row * width + x, row * width + x + regionWidth);
    }
  }
  return masked;
}

function validateGeometry(geometry, label) {
  if (!geometry || !geometry.elements || typeof geometry.elements !== 'object') {
    throw new Error(`${label} geometry must contain an elements object.`);
  }
  return geometry.elements;
}

function validateGeometryValue(value, key, property, label) {
  const numericValue = requireFiniteNumber(value, `${key}.${property} ${label}`);
  if ((property === 'width' || property === 'height') && numericValue <= 0) {
    throw new Error(`${key}.${property} ${label} must be positive.`);
  }
  if ((property === 'x' || property === 'y') && numericValue < 0) {
    throw new Error(`${key}.${property} ${label} must not be negative.`);
  }
  return numericValue;
}

function compareGeometry(expectedGeometry, actualGeometry) {
  const expectedElements = validateGeometry(expectedGeometry, 'Expected');
  const actualElements = validateGeometry(actualGeometry, 'Actual');
  const entries = Object.entries(expectedElements);
  if (entries.length === 0) {
    throw new Error('Expected geometry must contain at least one key element.');
  }

  let maximumDelta = 0;
  const details = {};
  for (const [key, expected] of entries) {
    const actual = actualElements[key];
    if (!actual) {
      throw new Error(`Actual geometry is missing key element "${key}".`);
    }
    const deltas = {};
    for (const property of GEOMETRY_PROPERTIES) {
      const expectedValue = validateGeometryValue(expected[property], key, property, 'expected');
      const actualValue = validateGeometryValue(actual[property], key, property, 'actual');
      const delta = roundMetric(Math.abs(expectedValue - actualValue));
      deltas[property] = delta;
      maximumDelta = Math.max(maximumDelta, delta);
    }
    details[key] = deltas;
  }

  return { details, maximumDelta: roundMetric(maximumDelta) };
}

function compositeChannel(channel, alpha) {
  return Math.round((channel * alpha + 255 * (255 - alpha)) / 255);
}

function readCompositeRgb(image, offset) {
  const alpha = image.data[offset + 3];
  return [
    compositeChannel(image.data[offset], alpha),
    compositeChannel(image.data[offset + 1], alpha),
    compositeChannel(image.data[offset + 2], alpha),
  ];
}

export async function compareVisualEvidence({
  actual,
  actualGeometry,
  baseline,
  expectedGeometry,
  mask,
  outputDirectory,
  thresholds = VISUAL_THRESHOLDS,
}) {
  validateImage(baseline, 'Baseline');
  validateImage(actual, 'Actual');
  if (baseline.width !== actual.width || baseline.height !== actual.height) {
    throw new Error('Baseline and actual image dimensions must match.');
  }

  const masked = validateMask(mask, baseline.width, baseline.height);
  const geometry = compareGeometry(expectedGeometry, actualGeometry);
  const diff = new PNG({ height: baseline.height, width: baseline.width });
  let stablePixelCount = 0;
  let significantPixelCount = 0;
  let absoluteColorDifference = 0;

  for (let pixel = 0; pixel < baseline.width * baseline.height; pixel += 1) {
    const offset = pixel * 4;
    if (masked[pixel]) {
      diff.data.set([128, 128, 128, 72], offset);
      continue;
    }

    const baselineRgb = readCompositeRgb(baseline, offset);
    const actualRgb = readCompositeRgb(actual, offset);
    const channelDeltas = baselineRgb.map((channel, index) => Math.abs(channel - actualRgb[index]));
    const maximumChannelDelta = Math.max(...channelDeltas);
    absoluteColorDifference += channelDeltas.reduce((sum, value) => sum + value, 0);
    stablePixelCount += 1;
    if (maximumChannelDelta > SIGNIFICANT_COLOR_DELTA) {
      significantPixelCount += 1;
    }
    diff.data.set(
      maximumChannelDelta === 0
        ? [actualRgb[0], actualRgb[1], actualRgb[2], 32]
        : [255, 255 - maximumChannelDelta, 255 - maximumChannelDelta, 255],
      offset,
    );
  }

  if (stablePixelCount === 0) {
    throw new Error('Mask excludes every image pixel; no stable region remains.');
  }

  const metrics = {
    maxKeyGeometryDeltaPx: geometry.maximumDelta,
    significantPixelRatio: roundMetric(significantPixelCount / stablePixelCount),
    stableRegionSimilarity: roundMetric(1 - absoluteColorDifference / (stablePixelCount * 3 * 255)),
  };
  const checks = {
    maxKeyGeometryDeltaPx: metrics.maxKeyGeometryDeltaPx <= thresholds.maxKeyGeometryDeltaPx,
    significantPixelRatio: metrics.significantPixelRatio <= thresholds.significantPixelRatio,
    stableRegionSimilarity: metrics.stableRegionSimilarity >= thresholds.stableRegionSimilarity,
  };
  const report = {
    checks,
    geometry: geometry.details,
    maskVersion: mask.version,
    metrics,
    passed: Object.values(checks).every(Boolean),
    significantColorDelta: SIGNIFICANT_COLOR_DELTA,
    significantPixelCount,
    stablePixelCount,
    thresholds,
  };

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDirectory, 'diff.png'), PNG.sync.write(diff)),
    writeFile(path.join(outputDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`),
  ]);
  return report;
}

function parseArguments(argv) {
  const values = {};
  for (const argument of argv) {
    const match = /^--([a-z-]+)=(.+)$/.exec(argument);
    if (!match) {
      throw new Error(`Unknown argument: ${argument}`);
    }
    values[match[1]] = match[2];
  }
  const required = ['baseline', 'actual', 'mask', 'expected-geometry', 'actual-geometry', 'output'];
  for (const name of required) {
    if (!values[name]) {
      throw new Error(`--${name} is required.`);
    }
  }
  return values;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function runCli() {
  const args = parseArguments(process.argv.slice(2));
  const outputDirectory = path.resolve(args.output);
  if (!isInsidePath(ARTIFACT_ROOT, outputDirectory)) {
    throw new Error('Visual comparison output must remain under apps/miniprogram/.artifacts/.');
  }
  const [baseline, actual, mask, expectedGeometry, actualGeometry] = await Promise.all([
    readFile(path.resolve(args.baseline)).then((value) => PNG.sync.read(value)),
    readFile(path.resolve(args.actual)).then((value) => PNG.sync.read(value)),
    readJson(path.resolve(args.mask)),
    readJson(path.resolve(args['expected-geometry'])),
    readJson(path.resolve(args['actual-geometry'])),
  ]);
  const report = await compareVisualEvidence({
    actual,
    actualGeometry,
    baseline,
    expectedGeometry,
    mask,
    outputDirectory,
  });
  console.log(
    `[visual-compare] ${report.passed ? 'passed' : 'failed'}; similarity=${report.metrics.stableRegionSimilarity}; significant=${report.metrics.significantPixelRatio}; geometry=${report.metrics.maxKeyGeometryDeltaPx}px; mask=${report.maskVersion}`,
  );
  if (!report.passed) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(
      `[visual-compare] failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
