#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { DIST_ROOT, listFiles, normalizeRelativePath } from './build-tools.mjs';

export const PERFORMANCE_THRESHOLDS = Object.freeze({
  androidInteractiveMs: 2500,
  idealPageNodes: 1000,
  maxDirectChildren: 60,
  maxNodeDepth: 30,
  maximumMatrixRenderMs: 1000,
  maximumMatrixViewModelBytesNoGrowthCeiling: 171340,
  tapFeedbackMs: 100,
  tapPatchPaths: 2,
});

export const DESKTOP_LOGIC_SMOKE_CEILINGS = Object.freeze({
  maximumMatrixModelMs: 1000,
  tapHandlerMs: 100,
});

export const MAXIMUM_MATRIX_NODE_NO_GROWTH_CEILINGS = Object.freeze({
  'pages/manual-matrix-poc/index.wxml': 1445,
  'subpackages/scheduling/pages/manual/index.wxml': 1506,
});

const nonVisualTags = new Set(['block', 'template', 'wxs']);
const voidTags = new Set(['image', 'input', 'textarea']);

export function analyzeWxmlStructure(source) {
  return measureRenderedNodes(renderNodes(parseWxml(source), {}, { expandLoops: false }));
}

export function renderWxmlStructure(source, data) {
  return measureRenderedNodes(renderNodes(parseWxml(source), data, { expandLoops: true }));
}

export function evaluatePerformanceBudget(measurement) {
  const issues = [];
  const warnings = [];

  if (measurement.desktopMatrixModelLogicMs > DESKTOP_LOGIC_SMOKE_CEILINGS.maximumMatrixModelMs) {
    issues.push(
      `desktop matrix model logic ${measurement.desktopMatrixModelLogicMs.toFixed(2)}ms exceeds smoke ceiling ${DESKTOP_LOGIC_SMOKE_CEILINGS.maximumMatrixModelMs}ms`,
    );
  }
  if (
    measurement.maximumMatrixViewModelBytes >
    PERFORMANCE_THRESHOLDS.maximumMatrixViewModelBytesNoGrowthCeiling
  ) {
    issues.push(
      `matrix view-model payload ${measurement.maximumMatrixViewModelBytes} bytes exceeds no-growth ceiling ${PERFORMANCE_THRESHOLDS.maximumMatrixViewModelBytesNoGrowthCeiling}`,
    );
  }
  if (measurement.desktopTapHandlerLogicMs > DESKTOP_LOGIC_SMOKE_CEILINGS.tapHandlerMs) {
    issues.push(
      `desktop tap handler logic ${measurement.desktopTapHandlerLogicMs.toFixed(2)}ms exceeds smoke ceiling ${DESKTOP_LOGIC_SMOKE_CEILINGS.tapHandlerMs}ms`,
    );
  }
  if (measurement.tapPatchPaths > PERFORMANCE_THRESHOLDS.tapPatchPaths) {
    issues.push(
      `tap patch paths ${measurement.tapPatchPaths} exceeds ${PERFORMANCE_THRESHOLDS.tapPatchPaths}`,
    );
  }
  if (measurement.wxsSetDataCalls > 0) {
    issues.push(`WXS hot path contains ${measurement.wxsSetDataCalls} setData call(s)`);
  }
  for (const matrix of measurement.maximumMatrixStructures) {
    if (matrix.maxDepth >= PERFORMANCE_THRESHOLDS.maxNodeDepth) {
      issues.push(
        `${matrix.path} depth ${matrix.maxDepth} must stay below ${PERFORMANCE_THRESHOLDS.maxNodeDepth}`,
      );
    }
    if (matrix.maxDirectChildren >= PERFORMANCE_THRESHOLDS.maxDirectChildren) {
      issues.push(
        `${matrix.path} direct children ${matrix.maxDirectChildren} must stay below ${PERFORMANCE_THRESHOLDS.maxDirectChildren}`,
      );
    }
    const noGrowthCeiling = MAXIMUM_MATRIX_NODE_NO_GROWTH_CEILINGS[matrix.path];
    if (noGrowthCeiling === undefined) {
      issues.push(`${matrix.path} is missing a maximum-matrix no-growth ceiling`);
    } else if (matrix.nodeCount > noGrowthCeiling) {
      issues.push(
        `${matrix.path} maximum matrix node count ${matrix.nodeCount} exceeds no-growth ceiling ${noGrowthCeiling}`,
      );
    }
    if (matrix.nodeCount >= PERFORMANCE_THRESHOLDS.idealPageNodes) {
      warnings.push(
        `${matrix.path} expanded host-element lower bound is ${matrix.nodeCount}; the <${PERFORMANCE_THRESHOLDS.idealPageNodes} target remains best-effort for 600 logical cells`,
      );
    }
  }

  for (const structure of measurement.staticStructures) {
    if (structure.maxDepth >= PERFORMANCE_THRESHOLDS.maxNodeDepth) {
      issues.push(
        `${structure.path} depth ${structure.maxDepth} must stay below ${PERFORMANCE_THRESHOLDS.maxNodeDepth}`,
      );
    }
    if (structure.maxDirectChildren >= PERFORMANCE_THRESHOLDS.maxDirectChildren) {
      issues.push(
        `${structure.path} direct children ${structure.maxDirectChildren} must stay below ${PERFORMANCE_THRESHOLDS.maxDirectChildren}`,
      );
    }
    if (structure.nodeCount >= PERFORMANCE_THRESHOLDS.idealPageNodes) {
      warnings.push(
        `${structure.path} has ${structure.nodeCount} static nodes; target is <${PERFORMANCE_THRESHOLDS.idealPageNodes}`,
      );
    }
  }
  return { issues, warnings };
}

export async function auditMiniProgramPerformance({ outputDirectory = DIST_ROOT } = {}) {
  const staticStructures = listFiles(outputDirectory)
    .filter((filePath) => filePath.endsWith('.wxml'))
    .map((filePath) => ({
      ...analyzeWxmlStructure(readFileSync(filePath, 'utf8')),
      path: normalizeRelativePath(path.relative(outputDirectory, filePath)),
    }));
  const matrixPage = loadMaximumMatrixPage(outputDirectory);
  const matrixPocRelativePath = 'pages/manual-matrix-poc/index.wxml';
  const manualEditorRelativePath = 'subpackages/scheduling/pages/manual/index.wxml';
  const matrixTemplatePath = path.join(outputDirectory, 'pages', 'manual-matrix-poc', 'index.wxml');
  const matrixWxsPath = path.join(
    outputDirectory,
    'pages',
    'manual-matrix-poc',
    'matrix-gesture.wxs',
  );
  const maximumMatrixStructures = [
    {
      ...renderWxmlStructure(readFileSync(matrixTemplatePath, 'utf8'), matrixPage.instance.data),
      path: matrixPocRelativePath,
    },
    {
      ...renderWxmlStructure(
        readFileSync(path.join(outputDirectory, ...manualEditorRelativePath.split('/')), 'utf8'),
        createMaximumManualEditorData(matrixPage.instance.data),
      ),
      path: manualEditorRelativePath,
    },
  ];
  const wxsSource = readFileSync(matrixWxsPath, 'utf8');
  const measurement = {
    desktopMatrixModelLogicMs: matrixPage.renderLogicMs,
    desktopTapHandlerLogicMs: matrixPage.tapFeedbackLogicMs,
    maximumMatrixViewModelBytes: measureMaximumMatrixViewModelBytes(matrixPage.instance.data),
    maximumMatrixStructures,
    staticStructures,
    tapPatchPaths: matrixPage.tapPatchPaths,
    wxsSetDataCalls: (wxsSource.match(/\bsetData\s*\(/gu) ?? []).length,
  };
  return { ...measurement, ...evaluatePerformanceBudget(measurement) };
}

function measureMaximumMatrixViewModelBytes(data) {
  const { buildLabel, matrixGestureConfig, performanceEvidence, ...viewModel } = data;
  void buildLabel;
  void matrixGestureConfig;
  void performanceEvidence;
  return Buffer.byteLength(JSON.stringify(viewModel), 'utf8');
}

function createMaximumManualEditorData(matrixData) {
  return {
    ...matrixData,
    errorMessage: '',
    infoMessage: '',
    limitNotice: '已达到 20 人、30 天、600 个逻辑格上限。',
    memberPanelOpen: false,
    releaseDialogKind: '',
    stages: [
      { className: 'is-complete', label: '编辑', marker: '✓' },
      { className: '', label: '预览', marker: '2' },
      { className: '', label: '草稿', marker: '3' },
      { className: '', label: '发布', marker: '4' },
    ],
    state: 'editor',
  };
}

function parseWxml(source) {
  const root = { attributes: {}, children: [], tag: '#root' };
  const stack = [root];
  const withoutComments = source.replace(/<!--[\s\S]*?-->/gu, '');
  for (const match of withoutComments.matchAll(/<\s*(\/)?\s*([A-Za-z][\w-]*)([^>]*)>/gu)) {
    const closing = match[1] === '/';
    const tag = match[2];
    const suffix = match[3];
    if (closing) {
      const current = stack.pop();
      if (current?.tag !== tag) throw new Error(`mismatched closing tag </${tag}>`);
      continue;
    }
    const node = { attributes: parseAttributes(suffix), children: [], tag };
    stack.at(-1).children.push(node);
    if (!suffix.trimEnd().endsWith('/') && !voidTags.has(tag)) stack.push(node);
  }
  if (stack.length !== 1) throw new Error(`unclosed tag <${stack.at(-1).tag}>`);
  return root.children;
}

function parseAttributes(source) {
  const attributes = {};
  for (const match of source.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/gu)) {
    attributes[match[1]] = match[2];
  }
  if (/\bwx:else\b/u.test(source) && attributes['wx:else'] === undefined) {
    attributes['wx:else'] = '';
  }
  return attributes;
}

function renderNodes(nodes, scope, options) {
  const rendered = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.attributes['wx:if'] !== undefined) {
      const branches = [node];
      while (
        nodes[index + 1]?.attributes['wx:elif'] !== undefined ||
        nodes[index + 1]?.attributes['wx:else'] !== undefined
      ) {
        branches.push(nodes[(index += 1)]);
      }
      const candidates = [];
      for (const branch of branches) {
        if (branch.attributes['wx:else'] !== undefined) {
          candidates.push(branch);
          break;
        }
        const expression = branch.attributes['wx:if'] ?? branch.attributes['wx:elif'];
        const condition = evaluateCondition(expression, scope);
        if (condition === true) {
          candidates.push(branch);
          break;
        }
        if (condition === undefined) candidates.push(branch);
      }
      const alternatives = candidates.map((branch) => renderSingleNode(branch, scope, options));
      alternatives.sort(
        (left, right) =>
          measureRenderedNodes(right).nodeCount - measureRenderedNodes(left).nodeCount,
      );
      rendered.push(...(alternatives[0] ?? []));
      continue;
    }
    if (node.attributes['wx:elif'] !== undefined || node.attributes['wx:else'] !== undefined) {
      continue;
    }
    rendered.push(...renderSingleNode(node, scope, options));
  }
  return rendered;
}

function renderSingleNode(node, scope, options) {
  const loopExpression = node.attributes['wx:for'];
  if (loopExpression !== undefined) {
    const iterations = options.expandLoops ? resolveExpression(loopExpression, scope) : [undefined];
    if (!Array.isArray(iterations)) throw new Error(`wx:for is not an array: ${loopExpression}`);
    const itemName = node.attributes['wx:for-item'] || 'item';
    const indexName = node.attributes['wx:for-index'] || 'index';
    return iterations.flatMap((item, index) =>
      renderNodeWithoutLoop(node, { ...scope, [indexName]: index, [itemName]: item }, options),
    );
  }
  return renderNodeWithoutLoop(node, scope, options);
}

function renderNodeWithoutLoop(node, scope, options) {
  const children = renderNodes(node.children, scope, options);
  if (nonVisualTags.has(node.tag)) return children;
  return [{ children, tag: node.tag }];
}

function evaluateCondition(expression, scope) {
  if (typeof expression !== 'string') return undefined;
  const normalized = unwrapExpression(expression);
  const orParts = normalized.split(/\s*\|\|\s*/u);
  if (orParts.length > 1) {
    const values = orParts.map((part) => evaluateCondition(part, scope));
    if (values.includes(true)) return true;
    return values.every((value) => value === false) ? false : undefined;
  }
  const comparison = /^([\w.]+)\s*(===|!==)\s*['"]([^'"]*)['"]$/u.exec(normalized);
  if (comparison !== null) {
    const value = resolvePath(comparison[1], scope);
    if (value === undefined) return undefined;
    return comparison[2] === '===' ? value === comparison[3] : value !== comparison[3];
  }
  if (normalized.startsWith('!')) {
    const value = resolvePath(normalized.slice(1).trim(), scope);
    return value === undefined ? undefined : !value;
  }
  const value = resolvePath(normalized, scope);
  return value === undefined ? undefined : Boolean(value);
}

function resolveExpression(expression, scope) {
  return resolvePath(unwrapExpression(expression), scope);
}

function unwrapExpression(expression) {
  return expression.replace(/^\s*\{\{\s*|\s*\}\}\s*$/gu, '').trim();
}

function resolvePath(expression, scope) {
  if (!/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/u.test(expression)) return undefined;
  let value = scope;
  for (const segment of expression.split('.')) {
    if (value === null || typeof value !== 'object' || !(segment in value)) return undefined;
    value = value[segment];
  }
  return value;
}

function measureRenderedNodes(nodes) {
  let nodeCount = 0;
  let maxDepth = 0;
  let maxDirectChildren = 0;
  const visit = (node, depth) => {
    nodeCount += 1;
    maxDepth = Math.max(maxDepth, depth);
    maxDirectChildren = Math.max(maxDirectChildren, node.children.length);
    for (const child of node.children) visit(child, depth + 1);
  };
  for (const node of nodes) visit(node, 1);
  return { maxDepth, maxDirectChildren, nodeCount };
}

function loadMaximumMatrixPage(outputDirectory) {
  const pagePath = path.join(outputDirectory, 'pages', 'manual-matrix-poc', 'index.js');
  const require = createRequire(import.meta.url);
  const resolved = require.resolve(pagePath);
  const previousPage = globalThis.Page;
  const previousWx = globalThis.wx;
  let definition;
  globalThis.Page = (value) => {
    definition = value;
  };
  globalThis.wx = { getWindowInfo: () => ({ windowWidth: 390 }) };
  try {
    delete require.cache[resolved];
    require(resolved);
  } finally {
    if (previousPage === undefined) delete globalThis.Page;
    else globalThis.Page = previousPage;
    if (previousWx === undefined) delete globalThis.wx;
    else globalThis.wx = previousWx;
  }
  if (definition === undefined) throw new Error('maximum matrix page did not register');

  let renderLogicMs = 0;
  let instance;
  for (let index = 0; index < 5; index += 1) {
    const candidate = createPageInstance(definition);
    const startedAt = performance.now();
    definition.onLoad.call(candidate, { mode: 'maximum' });
    renderLogicMs = Math.max(renderLogicMs, performance.now() - startedAt);
    instance = candidate;
  }
  let tapFeedbackLogicMs = 0;
  let tapPatchPaths = 0;
  for (let index = 0; index < 20; index += 1) {
    const candidate = createPageInstance(definition);
    definition.onLoad.call(candidate, { mode: 'maximum' });
    candidate.lastPatchKeys = [];
    const cell = candidate.data.rows[0].cells[0];
    const startedAt = performance.now();
    definition.handleCellTap.call(candidate, {
      currentTarget: {
        dataset: { columnIndex: 0, key: cell.key, rowIndex: 0 },
      },
    });
    tapFeedbackLogicMs = Math.max(tapFeedbackLogicMs, performance.now() - startedAt);
    tapPatchPaths = Math.max(
      tapPatchPaths,
      candidate.lastPatchKeys.filter((key) => /^rows\[\d+\]\.cells\[\d+\]$/u.test(key)).length,
    );
  }
  return { instance, renderLogicMs, tapFeedbackLogicMs, tapPatchPaths };
}

function createPageInstance(definition) {
  const instance = {
    ...definition,
    data: structuredClone(definition.data),
    lastPatchKeys: [],
    setData(patch) {
      this.lastPatchKeys = Object.keys(patch);
      applySetDataPatch(this.data, patch);
    },
  };
  return instance;
}

function applySetDataPatch(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    const cellPath = /^rows\[(\d+)\]\.cells\[(\d+)\]$/u.exec(key);
    if (cellPath === null) target[key] = value;
    else target.rows[Number(cellPath[1])].cells[Number(cellPath[2])] = value;
  }
}

async function runCli() {
  const report = await auditMiniProgramPerformance();
  for (const warning of report.warnings)
    console.warn(`[miniprogram-performance] warning: ${warning}`);
  for (const issue of report.issues) console.error(`[miniprogram-performance] ${issue}`);
  if (report.issues.length > 0) process.exit(1);
  const structures = report.maximumMatrixStructures
    .map((item) => `${item.path}:${item.nodeCount}/${item.maxDepth}/${item.maxDirectChildren}`)
    .join(',');
  console.log(
    `[miniprogram-performance] passed; maximumStructures=${structures}; ` +
      `maximumViewModelBytes=${report.maximumMatrixViewModelBytes}; ` +
      `desktopMatrixLogicMs=${report.desktopMatrixModelLogicMs.toFixed(2)}; ` +
      `desktopTapLogicMs=${report.desktopTapHandlerLogicMs.toFixed(2)}; tapCellPaths=${report.tapPatchPaths}`,
  );
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
