import fs from 'node:fs';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const allowedStates = new Set([
  'active',
  'blocked',
  'fixed-pending-external',
  'fixed-guarded',
  'superseded',
]);

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('selective agent context policy', () => {
  it('keeps the always-read status concise', () => {
    const status = read('docs/project-status.md');

    expect(Buffer.byteLength(status)).toBeLessThanOrEqual(40 * 1024);
    expect(status.split(/\r?\n/u).length).toBeLessThanOrEqual(250);
  });

  it('keeps one small valid pitfall index with resolvable selective details', () => {
    const indexPath = 'docs/agent-context/pitfall-index.json';
    const source = read(indexPath);
    const index = JSON.parse(source);

    expect(Buffer.byteLength(source)).toBeLessThanOrEqual(12 * 1024);
    expect(index.schemaVersion).toBe(1);
    expect(Array.isArray(index.pitfalls)).toBe(true);
    expect(new Set(index.pitfalls.map((entry) => entry.id)).size).toBe(index.pitfalls.length);
    for (const entry of index.pitfalls) {
      expect(entry.id).toMatch(/^[a-z0-9-]+$/u);
      expect(allowedStates.has(entry.state)).toBe(true);
      expect(entry.signals.length).toBeGreaterThan(0);
      expect(entry.paths.length).toBeGreaterThan(0);
      expect(entry.validation.length).toBeGreaterThan(0);
      expect(entry.staleWhen.length).toBeGreaterThan(0);
      for (const linkedPath of [entry.detail, entry.guard]) {
        expect(fs.existsSync(path.join(root, linkedPath)), `${entry.id}: ${linkedPath}`).toBe(true);
      }
      expect(read(entry.detail).split(/\r?\n/u).length).toBeLessThanOrEqual(120);
    }
  });

  it('routes agents through the index instead of loading all debug history', () => {
    const agents = read('AGENTS.md');

    expect(agents).toContain('docs/agent-context/pitfall-index.json');
    expect(agents).toContain('only the matching pitfall detail files');
    expect(agents).toContain('Do not read `docs/debug/debug-feedback-log.md` completely');
  });
});
