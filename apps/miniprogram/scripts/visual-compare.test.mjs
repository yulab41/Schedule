import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

import { compareVisualEvidence } from './visual-compare.mjs';

function createImage(width, height, color = [255, 255, 255, 255]) {
  const image = new PNG({ height, width });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data.set(color, offset);
  }
  return image;
}

function paintPixel(image, x, y, color) {
  image.data.set(color, (y * image.width + x) * 4);
}

const geometry = {
  elements: {
    calendar: { height: 60, width: 80, x: 10, y: 20 },
  },
};

describe('visual evidence comparator', () => {
  it('passes identical stable pixels and writes a machine-readable report and heatmap', async () => {
    const outputDirectory = await mkdtemp(path.join(tmpdir(), 'schedule-visual-pass-'));
    const baseline = createImage(10, 10);

    try {
      const result = await compareVisualEvidence({
        actual: baseline,
        actualGeometry: geometry,
        baseline,
        expectedGeometry: geometry,
        mask: { height: 10, regions: [], version: 'p1-v1', width: 10 },
        outputDirectory,
      });

      expect(result.passed).toBe(true);
      expect(result.metrics).toEqual({
        maxKeyGeometryDeltaPx: 0,
        significantPixelRatio: 0,
        stableRegionSimilarity: 1,
      });
      expect(JSON.parse(await readFile(path.join(outputDirectory, 'report.json'), 'utf8'))).toEqual(
        expect.objectContaining({ maskVersion: 'p1-v1', passed: true }),
      );
      expect(PNG.sync.read(await readFile(path.join(outputDirectory, 'diff.png')))).toMatchObject({
        height: 10,
        width: 10,
      });
    } finally {
      await rm(outputDirectory, { force: true, recursive: true });
    }
  });

  it('excludes only declared mask rectangles from visual metrics', async () => {
    const outputDirectory = await mkdtemp(path.join(tmpdir(), 'schedule-visual-mask-'));
    const baseline = createImage(10, 10);
    const actual = createImage(10, 10);
    paintPixel(actual, 0, 0, [0, 0, 0, 255]);

    try {
      const result = await compareVisualEvidence({
        actual,
        actualGeometry: geometry,
        baseline,
        expectedGeometry: geometry,
        mask: {
          height: 10,
          regions: [{ height: 1, reason: 'status-bar-clock', width: 1, x: 0, y: 0 }],
          version: 'p1-v1',
          width: 10,
        },
        outputDirectory,
      });

      expect(result.passed).toBe(true);
      expect(result.stablePixelCount).toBe(99);
      expect(result.metrics.stableRegionSimilarity).toBe(1);
    } finally {
      await rm(outputDirectory, { force: true, recursive: true });
    }
  });

  it('fails independently when significant pixels or geometry exceed their thresholds', async () => {
    const outputDirectory = await mkdtemp(path.join(tmpdir(), 'schedule-visual-fail-'));
    const baseline = createImage(10, 10);
    const actual = createImage(10, 10);
    paintPixel(actual, 0, 0, [0, 0, 0, 255]);
    paintPixel(actual, 1, 0, [0, 0, 0, 255]);
    paintPixel(actual, 2, 0, [0, 0, 0, 255]);

    try {
      const result = await compareVisualEvidence({
        actual,
        actualGeometry: {
          elements: { calendar: { height: 60, width: 80, x: 13, y: 20 } },
        },
        baseline,
        expectedGeometry: geometry,
        mask: { height: 10, regions: [], version: 'p1-v1', width: 10 },
        outputDirectory,
      });

      expect(result.passed).toBe(false);
      expect(result.checks.significantPixelRatio).toBe(false);
      expect(result.checks.maxKeyGeometryDeltaPx).toBe(false);
      expect(result.metrics.significantPixelRatio).toBe(0.03);
      expect(result.metrics.maxKeyGeometryDeltaPx).toBe(3);
    } finally {
      await rm(outputDirectory, { force: true, recursive: true });
    }
  });

  it('fails closed for incompatible images, masks, and missing key geometry', async () => {
    const outputDirectory = await mkdtemp(path.join(tmpdir(), 'schedule-visual-invalid-'));
    const baseline = createImage(10, 10);

    try {
      await expect(
        compareVisualEvidence({
          actual: createImage(9, 10),
          actualGeometry: geometry,
          baseline,
          expectedGeometry: geometry,
          mask: { height: 10, regions: [], version: 'p1-v1', width: 10 },
          outputDirectory,
        }),
      ).rejects.toThrow(/dimensions/i);

      await expect(
        compareVisualEvidence({
          actual: baseline,
          actualGeometry: { elements: {} },
          baseline,
          expectedGeometry: geometry,
          mask: { height: 10, regions: [], version: 'p1-v1', width: 10 },
          outputDirectory,
        }),
      ).rejects.toThrow(/calendar/);

      await expect(
        compareVisualEvidence({
          actual: baseline,
          actualGeometry: geometry,
          baseline,
          expectedGeometry: {
            elements: { calendar: { height: 60, width: 0, x: 10, y: 20 } },
          },
          mask: { height: 10, regions: [], version: 'p1-v1', width: 10 },
          outputDirectory,
        }),
      ).rejects.toThrow(/width.*positive/i);

      await expect(
        compareVisualEvidence({
          actual: baseline,
          actualGeometry: geometry,
          baseline,
          expectedGeometry: geometry,
          mask: {
            height: 10,
            regions: [{ height: 5, reason: 'business-card', width: 5, x: 8, y: 8 }],
            version: 'p1-v1',
            width: 10,
          },
          outputDirectory,
        }),
      ).rejects.toThrow(/outside/i);

      await expect(
        compareVisualEvidence({
          actual: baseline,
          actualGeometry: geometry,
          baseline,
          expectedGeometry: geometry,
          mask: {
            height: 10,
            regions: [{ height: 10, reason: 'status-bar-full', width: 10, x: 0, y: 0 }],
            version: 'p1-v1',
            width: 10,
          },
          outputDirectory,
        }),
      ).rejects.toThrow(/no stable region/i);
    } finally {
      await rm(outputDirectory, { force: true, recursive: true });
    }
  });
});
