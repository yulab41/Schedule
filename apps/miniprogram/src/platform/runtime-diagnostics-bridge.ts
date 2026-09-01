import {
  RUNTIME_DIAGNOSTIC_ERROR_LIMIT,
  RUNTIME_DIAGNOSTIC_PERFORMANCE_LIMIT,
  RUNTIME_DIAGNOSTIC_REQUEST_LIMIT,
} from './runtime-diagnostics-limits.js';
import type {
  RuntimeDiagnosticError,
  RuntimeDiagnosticPerformance,
  RuntimeDiagnosticRequestInput,
  RuntimeDiagnosticsSlot,
} from './runtime-diagnostics-types.js';

export function recordRuntimeDiagnosticRequest(entry: RuntimeDiagnosticRequestInput): void {
  boundedPush(resolveSlot()?.requests, entry, RUNTIME_DIAGNOSTIC_REQUEST_LIMIT);
}

export function recordRuntimeDiagnosticError(entry: RuntimeDiagnosticError): void {
  boundedPush(resolveSlot()?.errors, entry, RUNTIME_DIAGNOSTIC_ERROR_LIMIT);
}

export function recordRuntimeDiagnosticPerformance(entry: RuntimeDiagnosticPerformance): void {
  boundedPush(resolveSlot()?.performance, entry, RUNTIME_DIAGNOSTIC_PERFORMANCE_LIMIT);
}

export function isRuntimeDirectorySearchRecording(): boolean {
  return resolveSlot()?.directorySearchRecording === true;
}

function resolveSlot(): RuntimeDiagnosticsSlot | undefined {
  try {
    return getApp<{ globalData?: { runtimeDiagnostics?: RuntimeDiagnosticsSlot } }>().globalData
      ?.runtimeDiagnostics;
  } catch {
    return undefined;
  }
}

function boundedPush<T>(target: T[] | undefined, value: T, maximum: number): void {
  try {
    if (target === undefined) return;
    target.push(value);
    if (target.length > maximum) target.shift();
  } catch {
    // Diagnostics must never alter request, error, or performance behavior.
  }
}
