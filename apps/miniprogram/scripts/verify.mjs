#!/usr/bin/env node

import {
  auditBuiltTree,
  auditPackageSize,
  auditSourceTree,
  buildMiniProgram,
  printIssues,
  readProfileArgument,
  verifyDeterministicBuild,
} from './build-tools.mjs';
import { auditMiniProgramPerformance } from './performance-budget.mjs';

const profile = readProfileArgument();
const source = auditSourceTree();
printIssues('miniprogram-source', source.issues);
if (source.issues.length > 0) process.exit(1);

await buildMiniProgram({ profile });
const built = auditBuiltTree();
if (built.workletCount < source.workletCount) {
  built.issues.push(
    `compiled Worklet count ${built.workletCount} is lower than source count ${source.workletCount}`,
  );
}
printIssues('miniprogram-build', built.issues);
if (built.issues.length > 0) process.exit(1);

const packageAudit = auditPackageSize();
printIssues('miniprogram-package', packageAudit.issues);
for (const warning of packageAudit.warnings) {
  console.warn(`[miniprogram-package] warning: ${warning}`);
}
if (packageAudit.issues.length > 0) process.exit(1);

const performanceAudit = await auditMiniProgramPerformance();
printIssues('miniprogram-performance', performanceAudit.issues);
for (const warning of performanceAudit.warnings) {
  console.warn(`[miniprogram-performance] warning: ${warning}`);
}
if (performanceAudit.issues.length > 0) process.exit(1);

const deterministic = await verifyDeterministicBuild(profile);
printIssues('miniprogram-determinism', deterministic.issues);
if (deterministic.issues.length > 0) process.exit(1);

console.log(
  `[miniprogram-verify] passed; profile=${profile}; sourceWorklets=${source.workletCount}; ` +
    `outputWorklets=${built.workletCount}; packageBytes=${packageAudit.totalBytes}; ` +
    `matrixNodes=${performanceAudit.maximumMatrixStructures.map((item) => item.nodeCount).join('/')}; ` +
    `matrixViewModelBytes=${performanceAudit.maximumMatrixViewModelBytes}; ` +
    `desktopMatrixLogicMs=${performanceAudit.desktopMatrixModelLogicMs.toFixed(2)}; ` +
    `desktopTapLogicMs=${performanceAudit.desktopTapHandlerLogicMs.toFixed(2)}; ` +
    `manifest=${deterministic.manifestSha256}`,
);
