import { describe, expect, it, vi } from 'vitest';

import {
  buildWorkflowPreviewFingerprint,
  createWorkflowOperationRuntime,
  type WorkflowContext,
} from './workflow-operation.js';

function createDeferred<Value>() {
  let reject: ((error: unknown) => void) | undefined;
  let resolve: ((value: Value) => void) | undefined;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {
    promise,
    reject(error: unknown): void {
      reject?.(error);
    },
    resolve(value: Value): void {
      resolve?.(value);
    },
  };
}

const firstContext: WorkflowContext = {
  groupId: 'group-1',
  groupRole: 'member',
  groupVersion: 2,
  userId: 'user-1',
};

describe('workflow operation runtime', () => {
  it('single-flights one context/key and permits an explicit later submission', async () => {
    const request = createDeferred<'done'>();
    const mutate = vi.fn(() => request.promise);
    const runtime = createWorkflowOperationRuntime({ refresh: vi.fn(() => Promise.resolve()) });
    runtime.activate(firstContext);

    const first = runtime.run('swap:create', mutate);
    const second = runtime.run('swap:create', mutate);
    expect(second).toBe(first);
    expect(mutate).toHaveBeenCalledTimes(1);

    request.resolve('done');
    await expect(first).resolves.toBe('done');
    await runtime.run('swap:create', mutate);
    expect(mutate).toHaveBeenCalledTimes(2);
  });

  it('uses a stable preview fingerprint and discards preview on a context generation change', async () => {
    const fingerprint = buildWorkflowPreviewFingerprint({
      targetAssignmentId: 'assignment-2',
      targetMembershipId: 'member-2',
    });
    expect(fingerprint).toBe(
      buildWorkflowPreviewFingerprint({
        targetMembershipId: 'member-2',
        targetAssignmentId: 'assignment-2',
      }),
    );

    const request = createDeferred<void>();
    const events: string[] = [];
    const runtime = createWorkflowOperationRuntime({
      publish: (event) => events.push(event.kind),
      refresh: vi.fn(() => Promise.resolve()),
    });
    runtime.activate(firstContext);
    runtime.setPreview(fingerprint, { id: 'preview-1' });
    const operation = runtime.run('swap:create', () => request.promise);
    runtime.activate({ ...firstContext, groupId: 'group-2', groupVersion: 3 });
    request.resolve();
    await operation;

    expect(runtime.getPreview(fingerprint)).toBeUndefined();
    expect(events).toEqual([]);
  });

  it('does not reuse an old in-flight request after a context generation change', async () => {
    const oldRequest = createDeferred<'old'>();
    const newRequest = createDeferred<'new'>();
    const mutate = vi
      .fn<() => Promise<'old' | 'new'>>()
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);
    const runtime = createWorkflowOperationRuntime({ refresh: vi.fn(() => Promise.resolve()) });
    runtime.activate(firstContext);

    const oldOperation = runtime.run('leave:create', mutate);
    runtime.activate({ ...firstContext, groupId: 'group-2', groupVersion: 3 });
    runtime.activate(firstContext);
    const newOperation = runtime.run('leave:create', mutate);

    expect(newOperation).not.toBe(oldOperation);
    expect(mutate).toHaveBeenCalledTimes(2);
    oldRequest.resolve('old');
    newRequest.resolve('new');
    await expect(oldOperation).resolves.toBe('old');
    await expect(newOperation).resolves.toBe('new');
  });

  it('on 409 clears preview, refreshes first, then publishes the original message and safe summary', async () => {
    const events: string[] = [];
    const refresh = vi.fn(async () => {
      events.push('refresh');
    });
    const runtime = createWorkflowOperationRuntime({
      publish: (event) => events.push(event.kind === 'conflict' ? event.message : event.kind),
      refresh,
    });
    const fingerprint = buildWorkflowPreviewFingerprint({ assignmentId: 'assignment-1' });
    runtime.activate(firstContext);
    runtime.setPreview(fingerprint, { id: 'preview-1' });
    const conflict = Object.assign(new Error('班次已经被其他操作更新。'), {
      latestData: {
        conflicts: [{ message: '成员时间重叠' }],
        ignored: { secret: 'do not publish' },
        periodVersions: { 'period-1': 8 },
        rulesVersion: 7,
        status: 'pending_approval',
        version: 6,
        workflowBlockers: [{ message: '已有活动流程' }],
      },
      status: 409,
    });

    await expect(runtime.run('swap:create', () => Promise.reject(conflict))).rejects.toBe(conflict);

    expect(runtime.getPreview(fingerprint)).toBeUndefined();
    expect(refresh).toHaveBeenCalledWith(firstContext);
    expect(events).toEqual(['preview-invalidated', 'refresh', '班次已经被其他操作更新。']);
    expect(runtime.lastConflict).toEqual({
      message: '班次已经被其他操作更新。',
      summary: {
        conflictCount: 1,
        periodVersions: { 'period-1': 8 },
        reasons: ['成员时间重叠', '已有活动流程'],
        rulesVersion: 7,
        status: 'pending_approval',
        version: 6,
        workflowBlockerCount: 1,
      },
    });
    expect(runtime.lastError).toBe(conflict);
  });

  it('retains the original 409 even when the authority refresh fails and never replays the mutation', async () => {
    const mutate = vi.fn(() =>
      Promise.reject(
        Object.assign(new Error('原始冲突'), { latestData: { unknown: true }, status: 409 }),
      ),
    );
    const publish = vi.fn();
    const runtime = createWorkflowOperationRuntime({
      publish,
      refresh: vi.fn(() => Promise.reject(new Error('refresh failed'))),
    });
    runtime.activate(firstContext);

    await expect(runtime.run('leave:create', mutate)).rejects.toThrow('原始冲突');
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(runtime.lastConflict).toEqual({ message: '原始冲突' });
    expect(publish).toHaveBeenLastCalledWith({ kind: 'conflict', message: '原始冲突' });
  });
});
