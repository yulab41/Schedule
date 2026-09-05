// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';

import simulate from 'miniprogram-simulate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function renderDirectoryCard(properties) {
  let definition;
  vi.stubGlobal('Component', (value) => {
    definition = value;
  });
  await import('../src/subpackages/organization/components/directory-entry-card/tail-path/index.ts');
  const tailPath = simulate.load({
    ...definition,
    template: readFileSync(
      path.join(
        process.cwd(),
        'src/subpackages/organization/components/directory-entry-card/tail-path/index.wxml',
      ),
      'utf8',
    ),
  });
  await import('../src/subpackages/organization/components/directory-entry-card/index.ts');
  const template = readFileSync(
    path.join(
      process.cwd(),
      'src',
      'subpackages',
      'organization',
      'components',
      'directory-entry-card',
      'index.wxml',
    ),
    'utf8',
  );
  const id = simulate.load({
    ...definition,
    template,
    usingComponents: { 'directory-tail-path': tailPath },
  });
  const component = simulate.render(id, properties);
  component.attach(globalThis.document.body);
  return component;
}

describe('P10 directory entry card simulate parity', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('renders the explicit cross-component divider and preserves favorite/call events', async () => {
    const component = await renderDirectoryCard({
      entry: {
        contacts: [
          {
            id: 'contact-1',
            label: '固定电话',
            numbers: [
              {
                dialable: true,
                dialNumber: '075400000000',
                id: 'contact-1:full',
                label: '长号',
                number: '0754-00000000',
              },
            ],
            showLabel: false,
          },
        ],
        contexts: ['本部院区 › 行政职能'],
        employeeCodeLabel: '',
        employeeCodes: [],
        favorite: false,
        id: 'entry-1',
        jobTitles: [],
        kindLabel: '科室',
        mergeCountLabel: '',
        merged: false,
        notes: '',
        title: '院长办公室',
      },
      largeText: true,
      showDivider: true,
    });
    const favoriteListener = vi.fn();
    const callListener = vi.fn();
    component.addEventListener('favoritechange', favoriteListener);
    component.addEventListener('directorycall', callListener);

    const address = component.querySelector('.entry-context-path');
    expect(address).toBeDefined();
    expect(address.data.value).toBe('本部院区 › 行政职能');
    // simulate does not project Mini ARIA attributes into its HTML DOM. The
    // source contract separately asserts aria-label={{value}}; here verify the
    // actual child receives the full value and renders its uncompressed fallback.
    expect(address.querySelector('.directory-tail-path__text').dom.textContent).toBe(
      '本部院区 › 行政职能',
    );

    expect(component.querySelector('.directory-entry').dom.classList.contains('has-divider')).toBe(
      true,
    );
    expect(
      component.querySelector('.directory-entry').dom.classList.contains('is-large-text'),
    ).toBe(true);
    component.instance.handleFavorite();
    component.instance.handleCall({
      currentTarget: {
        dataset: { number: '075400000000', numberId: 'contact-1:full' },
      },
    });

    expect(favoriteListener.mock.calls[0][0].detail).toEqual({ groupId: 'entry-1' });
    expect(callListener.mock.calls[0][0].detail).toEqual({
      groupId: 'entry-1',
      number: '075400000000',
    });
    await vi.waitFor(() => expect(component.data.animatingNumberId).toBe('contact-1:full'));
  });
});
