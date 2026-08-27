import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

describe('Mini Page registration boundary', () => {
  it('forbids registered pages whose entire template is one injected business panel', () => {
    const app = JSON.parse(readFileSync(path.join(sourceRoot, 'app.json'), 'utf8'));
    const routes = [
      ...app.pages,
      ...app.subpackages.flatMap((subpackage) =>
        subpackage.pages.map((page) => `${subpackage.root}/${page}`),
      ),
    ];
    const offenders = [];

    for (const route of routes) {
      const config = JSON.parse(readFileSync(path.join(sourceRoot, `${route}.json`), 'utf8'));
      const template = readFileSync(path.join(sourceRoot, `${route}.wxml`), 'utf8').trim();
      const singleTag = template.match(/^<([a-z][\w-]*)\b[^>]*>[\s\S]*<\/\1>$/u)?.[1];
      const componentPath =
        singleTag === undefined ? undefined : config.usingComponents?.[singleTag];
      if (
        typeof componentPath === 'string' &&
        /\/components\/(?:workflow-)?[a-z0-9-]+-panel\/index$/u.test(componentPath)
      ) {
        offenders.push(`${route}:${singleTag}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps fixed Page/controller telemetry pairs for every migrated risk boundary', () => {
    const boundaries = [
      ['organization', 'directory', 'directory-panel/controller.ts', 'controller-attached'],
      ['organization', 'group-settings', 'group-settings-panel/controller.ts', 'controller-onload'],
      [
        'organization',
        'scheduling-config',
        'scheduling-config-panel/controller.ts',
        'controller-attached',
      ],
      [
        'organization',
        'invite-visitor',
        'invite-visitor-panel/controller.ts',
        'controller-attached',
      ],
      [
        'organization',
        'platform-accounts',
        'platform-accounts-panel/controller.ts',
        'controller-attached',
      ],
      ['workflows', 'duty', 'controller-host.ts', 'controller-onload'],
      ['workflows', 'leave', 'controller-host.ts', 'controller-onload'],
      ['workflows', 'swap', 'controller-host.ts', 'controller-onload'],
    ];

    for (const [subpackage, page, controllerPath, controllerStage] of boundaries) {
      const pageSource = read(`subpackages/${subpackage}/pages/${page}/index.ts`);
      const controllerSource = read(`subpackages/${subpackage}/components/${controllerPath}`);
      expect(pageSource).toContain(`'${page}:page-onload'`);
      if (subpackage === 'workflows') {
        expect(pageSource).toContain(`'${page}:${controllerStage}'`);
        expect(controllerSource).toContain('recordMiniTelemetryBoundary(boundary)');
      } else {
        expect(controllerSource).toContain(`'${page}:${controllerStage}'`);
      }
    }
  });
});

function read(relativePath) {
  return readFileSync(path.join(sourceRoot, relativePath), 'utf8');
}
