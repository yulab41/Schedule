#!/usr/bin/env node

import { auditSourceTree, printIssues } from './build-tools.mjs';

const result = auditSourceTree();
printIssues('miniprogram-source', result.issues);
if (result.issues.length > 0) process.exitCode = 1;
else console.log(`[miniprogram-source] passed; worklet directives: ${result.workletCount}`);
