import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  DESKTOP_LOGIC_SMOKE_CEILINGS,
  MAXIMUM_MATRIX_NODE_NO_GROWTH_CEILINGS,
  PERFORMANCE_THRESHOLDS,
  analyzeWxmlStructure,
  evaluatePerformanceBudget,
  renderWxmlStructure,
} from './performance-budget.mjs';

describe('P6 Mini Program performance budget', () => {
  it('counts rendered nodes, depth, and direct children after deterministic wx:for expansion', () => {
    const source = `
      <wxs module="ignored"></wxs>
      <view class="root">
        <block wx:for="{{rows}}" wx:for-item="row">
          <view class="row">
            <text wx:for="{{row.cells}}" wx:for-item="cell">{{cell}}</text>
          </view>
        </block>
      </view>
    `;

    expect(renderWxmlStructure(source, { rows: [{ cells: [1, 2] }, { cells: [3, 4] }] })).toEqual({
      maxDepth: 3,
      maxDirectChildren: 2,
      nodeCount: 7,
    });
    expect(analyzeWxmlStructure('<view><text></text><text></text></view>')).toEqual({
      maxDepth: 2,
      maxDirectChildren: 2,
      nodeCount: 3,
    });
  });

  it('omits deterministically false wx:if branches instead of counting their largest shape', () => {
    const source = `
      <view class="root">
        <text wx:if="{{showPrimary}}">primary</text>
        <view wx:if="{{state === 'ready'}}"><text>ready</text></view>
        <view wx:elif="{{state === 'error'}}"><text>error</text><text>retry</text></view>
      </view>
    `;

    expect(renderWxmlStructure(source, { showPrimary: false, state: 'idle' })).toEqual({
      maxDepth: 1,
      maxDirectChildren: 0,
      nodeCount: 1,
    });
  });

  it('fails hard timing and structure limits while treating the 1000-node target as a warning', () => {
    const result = evaluatePerformanceBudget({
      desktopMatrixModelLogicMs: 1001,
      desktopTapHandlerLogicMs: 101,
      maximumMatrixViewModelBytes: 171341,
      maximumMatrixStructures: [
        {
          maxDepth: 30,
          maxDirectChildren: 60,
          nodeCount: 1400,
          path: 'pages/manual-matrix-poc/index.wxml',
        },
        {
          maxDepth: 29,
          maxDirectChildren: 59,
          nodeCount: 1600,
          path: 'subpackages/scheduling/pages/manual/index.wxml',
        },
      ],
      staticStructures: [
        {
          maxDepth: 29,
          maxDirectChildren: 59,
          nodeCount: 1000,
          path: 'pages/example/index.wxml',
        },
      ],
      tapPatchPaths: 3,
      wxsSetDataCalls: 1,
    });

    expect(PERFORMANCE_THRESHOLDS).toEqual({
      androidInteractiveMs: 2500,
      idealPageNodes: 1000,
      maxDirectChildren: 60,
      maxNodeDepth: 30,
      maximumMatrixRenderMs: 1000,
      maximumMatrixViewModelBytesNoGrowthCeiling: 171340,
      tapFeedbackMs: 100,
      tapPatchPaths: 2,
    });
    expect(MAXIMUM_MATRIX_NODE_NO_GROWTH_CEILINGS).toEqual({
      'pages/manual-matrix-poc/index.wxml': 1445,
      'subpackages/scheduling/pages/manual/index.wxml': 1506,
    });
    expect(DESKTOP_LOGIC_SMOKE_CEILINGS).toEqual({
      maximumMatrixModelMs: 1000,
      tapHandlerMs: 100,
    });
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('desktop matrix model logic'),
        expect.stringContaining('matrix view-model payload'),
        expect.stringContaining('pages/manual-matrix-poc/index.wxml depth'),
        expect.stringContaining('pages/manual-matrix-poc/index.wxml direct children'),
        expect.stringContaining('desktop tap handler logic'),
        expect.stringContaining('tap patch paths'),
        expect.stringContaining('WXS hot path'),
        expect.stringContaining('subpackages/scheduling/pages/manual/index.wxml'),
      ]),
    );
    expect(result.warnings).toEqual([
      expect.stringContaining(
        'pages/manual-matrix-poc/index.wxml expanded host-element lower bound is 1400',
      ),
      expect.stringContaining(
        'subpackages/scheduling/pages/manual/index.wxml expanded host-element lower bound is 1600',
      ),
      expect.stringContaining('pages/example/index.wxml has 1000 static nodes'),
    ]);
  });

  it('keeps verify wired to the performance audit and the WXS matrix hot path free of setData', async () => {
    const verifySource = await readFile(new URL('./verify.mjs', import.meta.url), 'utf8');
    const matrixSource = await readFile(
      new URL('../src/pages/manual-matrix-poc/index.ts', import.meta.url),
      'utf8',
    );
    const workbenchSource = await readFile(
      new URL('../src/pages/workbench/index.ts', import.meta.url),
      'utf8',
    );
    const wxsSource = await readFile(
      new URL('../src/pages/manual-matrix-poc/matrix-gesture.wxs', import.meta.url),
      'utf8',
    );

    expect(verifySource).toContain('auditMiniProgramPerformance');
    expect(verifySource).toContain('miniprogram-performance');
    expect(matrixSource).toContain("options.performance === '1'");
    expect(matrixSource).toContain("complete('maximum-matrix-render')");
    expect(matrixSource).toContain("complete('tap-feedback')");
    expect(workbenchSource).toContain("options.performance === '1'");
    expect(workbenchSource).toContain("complete('core-ready')");
    expect(workbenchSource).toContain("complete('foreground-ready')");
    expect(wxsSource).not.toContain('setData');
  });
});
