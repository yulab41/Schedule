import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('workflow controller lifecycle generation', () => {
  let captureWorkflowControllerTask;
  let componentDefinition;
  let createWorkflowPageDefinition;
  let registerWorkflowPanel;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('Component', (value) => {
      componentDefinition = value;
    });
    ({ captureWorkflowControllerTask, createWorkflowPageDefinition, registerWorkflowPanel } =
      await import('../src/subpackages/workflows/components/controller-host.ts'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('drops a resolved continuation after component detach', async () => {
    const pending = deferred();
    const effects = createEffects();
    registerWorkflowPanel(createControllerFactory(new Map([['group-a', [pending]]]), effects));
    const instance = createHostInstance('group-a');

    componentDefinition.lifetimes.attached.call(instance);
    componentDefinition.lifetimes.detached.call(instance);
    const writesAfterDetach = instance.setDataCalls.length;
    pending.resolve('result-a');
    await flushAsyncWork();

    expect(instance.setDataCalls).toHaveLength(writesAfterDetach);
    expect(instance.data.result).toBe('');
    expect(instance._acceptedResult).toBe('');
    expect(resultEvents(instance)).toEqual([]);
    expect(effects.callback).not.toHaveBeenCalled();
    expect(effects.ui).not.toHaveBeenCalled();
  });

  it('handles a rejected continuation after detach without stale state or an unhandled promise', async () => {
    const pending = deferred();
    const effects = createEffects();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      registerWorkflowPanel(createControllerFactory(new Map([['group-a', [pending]]]), effects));
      const instance = createHostInstance('group-a');

      componentDefinition.lifetimes.attached.call(instance);
      componentDefinition.lifetimes.detached.call(instance);
      const writesAfterDetach = instance.setDataCalls.length;
      pending.reject(new Error('late failure'));
      await flushAsyncWork();

      expect(instance.setDataCalls).toHaveLength(writesAfterDetach);
      expect(instance.data.errorMessage).toBe('');
      expect(instance._acceptedError).toBe('');
      expect(resultEvents(instance)).toEqual([]);
      expect(effects.callback).not.toHaveBeenCalled();
      expect(effects.ui).not.toHaveBeenCalled();
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('keeps B when A resolves after a rapid A to B context switch', async () => {
    const requestA = deferred();
    const requestB = deferred();
    const effects = createEffects();
    registerWorkflowPanel(
      createControllerFactory(
        new Map([
          ['group-a', [requestA]],
          ['group-b', [requestB]],
        ]),
        effects,
      ),
    );
    const instance = createHostInstance('group-a');

    componentDefinition.lifetimes.attached.call(instance);
    instance.properties.groupId = 'group-b';
    componentDefinition.observers.groupId.call(instance);
    requestB.resolve('result-b');
    await flushAsyncWork();
    expect(instance.data.result).toBe('result-b');
    const writesAfterB = instance.setDataCalls.length;
    const eventsAfterB = resultEvents(instance);

    requestA.resolve('result-a');
    await flushAsyncWork();

    expect(instance.data.result).toBe('result-b');
    expect(instance._acceptedResult).toBe('result-b');
    expect(instance.setDataCalls).toHaveLength(writesAfterB);
    expect(resultEvents(instance)).toEqual(eventsAfterB);
    expect(effects.callback).toHaveBeenCalledTimes(1);
    expect(effects.ui).toHaveBeenCalledTimes(1);
    expect(effects.ui).toHaveBeenLastCalledWith('result-b');
  });

  it('does not collide when a detached host reattaches with a fresh controller', async () => {
    const requestA = deferred();
    const requestB = deferred();
    const effects = createEffects();
    registerWorkflowPanel(
      createControllerFactory(
        new Map([
          ['group-a', [requestA]],
          ['group-b', [requestB]],
        ]),
        effects,
      ),
    );
    const instance = createHostInstance('group-a');

    componentDefinition.lifetimes.attached.call(instance);
    componentDefinition.lifetimes.detached.call(instance);
    instance.properties.groupId = 'group-b';
    componentDefinition.lifetimes.attached.call(instance);
    requestB.resolve('result-b');
    await flushAsyncWork();
    const writesAfterB = instance.setDataCalls.length;

    requestA.resolve('result-a');
    await flushAsyncWork();

    expect(instance.data.result).toBe('result-b');
    expect(instance._acceptedResult).toBe('result-b');
    expect(instance.setDataCalls).toHaveLength(writesAfterB);
    expect(effects.ui).toHaveBeenCalledTimes(1);
  });

  it('accepts current concurrent work in completion order and drops every old completion', async () => {
    const requestA1 = deferred();
    const requestA2 = deferred();
    const requestB1 = deferred();
    const requestB2 = deferred();
    const effects = createEffects();
    registerWorkflowPanel(
      createControllerFactory(
        new Map([
          ['group-a', [requestA1, requestA2]],
          ['group-b', [requestB1, requestB2]],
        ]),
        effects,
      ),
    );
    const instance = createHostInstance('group-a');

    componentDefinition.lifetimes.attached.call(instance);
    instance.properties.groupId = 'group-b';
    componentDefinition.observers.groupId.call(instance);
    requestB2.resolve('result-b2');
    await flushAsyncWork();
    requestB1.resolve('result-b1');
    await flushAsyncWork();
    expect(instance.data.result).toBe('result-b1');
    const writesAfterB = instance.setDataCalls.length;

    requestA1.resolve('result-a1');
    requestA2.resolve('result-a2');
    await flushAsyncWork();

    expect(instance.data.result).toBe('result-b1');
    expect(instance.setDataCalls).toHaveLength(writesAfterB);
    expect(effects.ui.mock.calls).toEqual([['result-b2'], ['result-b1']]);
    expect(effects.callback).toHaveBeenCalledTimes(2);
    expect(resultEvents(instance).map((event) => event.detail.value)).toEqual([
      'result-b2',
      'result-b1',
    ]);
  });

  it('disposes the old controller when its group becomes unavailable', async () => {
    const pending = deferred();
    const effects = createEffects();
    registerWorkflowPanel(createControllerFactory(new Map([['group-a', [pending]]]), effects));
    const instance = createHostInstance('group-a');

    componentDefinition.lifetimes.attached.call(instance);
    instance.properties.groupId = '';
    componentDefinition.observers.groupId.call(instance);
    const writesAfterDispose = instance.setDataCalls.length;
    pending.resolve('result-a');
    await flushAsyncWork();

    expect(instance.__controller).toBeUndefined();
    expect(instance.data.result).toBe('');
    expect(instance.setDataCalls).toHaveLength(writesAfterDispose);
    expect(effects.ui).not.toHaveBeenCalled();
  });

  it('invalidates both resolved and rejected direct Page work after unload', async () => {
    const resolved = deferred();
    const rejected = deferred();
    const effects = createEffects();
    const page = createWorkflowPageDefinition(
      createControllerFactory(new Map([['group-a', [resolved, rejected]]]), effects),
    );
    const instance = createHostInstance('group-a');

    page.onLoad.call(instance, { groupId: 'group-a' });
    page.onUnload.call(instance);
    const writesAfterUnload = instance.setDataCalls.length;
    resolved.resolve('result-a');
    rejected.reject(new Error('late direct Page failure'));
    await flushAsyncWork();

    expect(instance.__attached).toBe(false);
    expect(instance.data.result).toBe('');
    expect(instance.data.errorMessage).toBe('');
    expect(instance.setDataCalls).toHaveLength(writesAfterUnload);
    expect(resultEvents(instance)).toEqual([]);
    expect(effects.callback).not.toHaveBeenCalled();
    expect(effects.ui).not.toHaveBeenCalled();
  });

  it('does not let an old attachment callback emit ready after detach and reattach', () => {
    registerWorkflowPanel(() => ({ data: { embedded: true, errorMessage: '', result: '' } }));
    const instance = createHostInstance('group-a');
    const callbacks = [];
    instance.setData = function (patch, callback) {
      this.setDataCalls.push(patch);
      Object.assign(this.data, patch);
      if (callback !== undefined) callbacks.push(callback);
    };

    componentDefinition.lifetimes.attached.call(instance);
    componentDefinition.lifetimes.detached.call(instance);
    instance.properties.groupId = 'group-b';
    componentDefinition.lifetimes.attached.call(instance);

    callbacks[0]();
    expect(instance.events.filter((event) => event.name === 'workspaceready')).toEqual([]);
    callbacks[1]();
    expect(instance.events.filter((event) => event.name === 'workspaceready')).toHaveLength(1);
  });

  it.each([
    { asyncFunctions: 8, awaits: 23, controller: 'workflow-leave-panel' },
    { asyncFunctions: 12, awaits: 30, controller: 'workflow-swap-panel' },
    { asyncFunctions: 12, awaits: 30, controller: 'workflow-duty-panel' },
  ])('keeps every async function in $controller under the shared task contract', (expected) => {
    const relativePath = `src/subpackages/workflows/components/${expected.controller}/controller.ts`;
    const source = readFileSync(path.join(appRoot, relativePath), 'utf8');
    const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true);
    const asyncFunctions = [];
    let awaitCount = 0;

    const visit = (node) => {
      if (
        ts.isFunctionDeclaration(node) &&
        node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) === true
      ) {
        const body = node.body?.getText(sourceFile) ?? '';
        const captureOffset = body.indexOf('captureWorkflowControllerTask(page)');
        const awaitOffset = body.indexOf('await ');
        asyncFunctions.push(node.name?.text ?? '<anonymous>');
        expect(
          captureOffset,
          `${relativePath}:${node.name?.text} is missing the task capture`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          captureOffset,
          `${relativePath}:${node.name?.text} captures after its first await`,
        ).toBeLessThan(awaitOffset);
      }
      if (ts.isAwaitExpression(node)) awaitCount += 1;
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    expect(asyncFunctions).toHaveLength(expected.asyncFunctions);
    expect(awaitCount).toBe(expected.awaits);
    expect(source.match(/task\.isCurrent\(\)/gu)?.length ?? 0).toBeGreaterThanOrEqual(awaitCount);
  });

  it('guards every explicit Promise continuation against a context switch before its microtask', () => {
    const relativePath = 'src/subpackages/workflows/components/workflow-swap-panel/controller.ts';
    const source = readFileSync(path.join(appRoot, relativePath), 'utf8');
    const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true);
    const continuations = [];

    const visit = (node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'then'
      ) {
        continuations.push(node);
        const callback = node.arguments[0];
        expect(callback, `${relativePath} has a .then() without a callback`).toBeDefined();
        expect(
          callback.getText(sourceFile),
          `${relativePath}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1} has an unguarded Promise continuation`,
        ).toContain('task.isCurrent()');
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    expect(continuations).toHaveLength(3);
  });

  function createControllerFactory(pendingByGroup, effects) {
    return () => ({
      data: { embedded: true, errorMessage: '', result: '' },
      _acceptedError: '',
      _acceptedResult: '',
      _loadSerial: 0,
      onLoad({ groupId }) {
        const serial = ++this._loadSerial;
        const task = captureWorkflowControllerTask?.(this) ?? { isCurrent: () => true };
        for (const pending of pendingByGroup.get(groupId) ?? []) {
          void pending.promise.then(
            (value) => {
              if (serial !== this._loadSerial || !task.isCurrent()) return;
              this._acceptedResult = value;
              this.setData({ errorMessage: '', result: value }, effects.callback);
              this.triggerEvent?.('result', { value });
              effects.ui(value);
            },
            (error) => {
              if (serial !== this._loadSerial || !task.isCurrent()) return;
              this._acceptedError = error.message;
              this.setData({ errorMessage: error.message });
              this.triggerEvent?.('result', { error: error.message });
              effects.ui(error.message);
            },
          );
        }
      },
    });
  }

  function createEffects() {
    return { callback: vi.fn(), ui: vi.fn() };
  }

  function createHostInstance(groupId) {
    const data = { embedded: true, errorMessage: '', result: '' };
    return {
      __attached: false,
      __controller: undefined,
      __infoMessageTimer: undefined,
      __loadedGroupId: '',
      data,
      events: [],
      properties: { active: true, embedded: true, groupId },
      setDataCalls: [],
      setData(patch, callback) {
        this.setDataCalls.push(patch);
        Object.assign(data, patch);
        callback?.();
      },
      triggerEvent(name, detail) {
        this.events.push({ detail, name });
      },
    };
  }

  function deferred() {
    let reject;
    let resolve;
    const promise = new Promise((resolvePromise, rejectPromise) => {
      reject = rejectPromise;
      resolve = resolvePromise;
    });
    return { promise, reject, resolve };
  }

  async function flushAsyncWork() {
    await Promise.resolve();
    await Promise.resolve();
  }

  function resultEvents(instance) {
    return instance.events.filter((event) => event.name === 'result');
  }
});
