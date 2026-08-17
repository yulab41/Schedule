#!/usr/bin/env node

import { auditPackageSize, printIssues } from './build-tools.mjs';

const result = auditPackageSize();
printIssues('miniprogram-package', result.issues);
for (const warning of result.warnings) console.warn(`[miniprogram-package] warning: ${warning}`);
if (result.issues.length > 0) process.exitCode = 1;
else {
  console.log(
    `[miniprogram-package] passed; total ${result.totalBytes} bytes; ${JSON.stringify(result.packages)}`,
  );
}
