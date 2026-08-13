#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CLIENT_CORE_TARGET_BYTES,
  inspectPackedClientCoreMiniProgramBundle,
  preparePackedClientCoreBuild,
} from './miniprogram-client-core-bundle-gate.mjs';
import {
  inspectPackedCalendarCoreMiniProgramBundle,
  preparePackedCalendarCoreBuild,
} from './miniprogram-calendar-core-bundle-gate.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const devToolsScript = fileURLToPath(new URL('./miniprogram-devtools.mjs', import.meta.url));

function parseDevToolsBuildSummary(output) {
  const candidates = output.match(/\{[\s\S]*?\}/gu) ?? [];
  for (const candidate of candidates.reverse()) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed.cost === 'number' && Array.isArray(parsed.warnings)) {
        return parsed;
      }
    } catch {
      // Other command output may contain non-JSON braces.
    }
  }
  return undefined;
}

export function findDevToolsBuildIssues({ error, output, status }) {
  if (error !== undefined) {
    return [`DevTools build-npm failed to start: ${error.message}`];
  }
  if (status !== 0) {
    return [`DevTools build-npm exited with status ${status ?? 'unknown'}`];
  }
  const summary = parseDevToolsBuildSummary(output);
  if (summary === undefined) {
    return ['DevTools build-npm did not report a warnings array'];
  }
  return summary.warnings.map((warning) => `DevTools build-npm warning: ${String(warning)}`);
}

export function runClientCoreDevToolsBuild({ spawn = spawnSync } = {}) {
  preparePackedClientCoreBuild();
  preparePackedCalendarCoreBuild();
  const result = spawn(process.execPath, [devToolsScript, 'build-npm'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  if (stdout.length > 0) process.stdout.write(stdout);
  if (stderr.length > 0) process.stderr.write(stderr);

  const issues = findDevToolsBuildIssues({
    error: result.error,
    output: `${stdout}\n${stderr}`,
    status: result.status,
  });
  if (issues.length === 0) {
    const inspection = inspectPackedClientCoreMiniProgramBundle();
    issues.push(...inspection.issues);
    if (issues.length === 0) {
      const targetStatus =
        inspection.byteLength <= CLIENT_CORE_TARGET_BYTES ? 'within target' : 'within hard limit';
      console.log(
        `[miniprogram-client-core] ${path.relative(repositoryRoot, inspection.bundlePath)}: ${inspection.byteLength} bytes (${targetStatus}), sha256 ${inspection.sha256}`,
      );
    }
    const calendarInspection = inspectPackedCalendarCoreMiniProgramBundle();
    issues.push(...calendarInspection.issues);
    if (calendarInspection.issues.length === 0) {
      console.log(
        `[miniprogram-calendar-core] ${path.relative(repositoryRoot, calendarInspection.bundlePath)}: ${calendarInspection.byteLength} bytes, sha256 ${calendarInspection.sha256}`,
      );
    }
  }

  for (const issue of issues) {
    console.error(`[miniprogram-client-core] ${issue}`);
  }
  return issues.length === 0 ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = runClientCoreDevToolsBuild();
}
