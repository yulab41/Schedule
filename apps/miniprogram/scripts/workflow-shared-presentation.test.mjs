import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const controllerPaths = [
  '../src/subpackages/workflows/components/workflow-leave-panel/controller.ts',
  '../src/subpackages/workflows/components/workflow-swap-panel/controller.ts',
  '../src/subpackages/workflows/components/workflow-duty-panel/controller.ts',
];

describe('workflow shared presentation boundary', () => {
  it.each(controllerPaths)(
    '%s consumes presentation-core instead of private rule copies',
    (path) => {
      const source = readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

      expect(source).toMatch(/from '@schedule\/presentation-core';/u);
      expect(source).not.toMatch(/function get(?:Swap|Duty|Leave)StatusLabel\(/u);
      expect(source).not.toMatch(/function getStatusTone\(/u);
      expect(source).not.toMatch(/function getNextStatusDescription\(/u);
    },
  );
});
