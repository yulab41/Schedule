import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { organizationReadApiGoldenResponse as golden } from '@schedule/client-core/testing';
import { describe, expect, it } from 'vitest';

import {
  decodeOrganizationGroupMembers,
  decodeOrganizationGroups,
} from '../src/platform/client-core-calendar.js';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workbenchReadSource = readFileSync(
  path.join(appRoot, 'src', 'platform', 'workbench-read.ts'),
  'utf8',
);

describe('P8 Mini organization shared read boundary', () => {
  it('uses shared strict decoders for group and member reads', () => {
    expect(decodeOrganizationGroups(golden.groups)).toBe(golden.groups);
    expect(decodeOrganizationGroupMembers(golden.members)).toBe(golden.members);
    expect(decodeOrganizationGroups([{ ...golden.groups[0], role: 'doctor' }])).toBeUndefined();
    expect(decodeOrganizationGroupMembers([{ ...golden.members[0], extra: true }])).toBeUndefined();
  });

  it('removes hand-written validators and persists an explicit group-summary allowlist', () => {
    expect(workbenchReadSource).toContain('createRuntimeOrganizationReadClient');
    expect(workbenchReadSource).toContain('organizationReadClient.listGroups()');
    expect(workbenchReadSource).toContain('organizationReadClient.listGroupMembers(groupId)');
    expect(workbenchReadSource).toContain('groupSummaryListDecoder.safeDecode');
    expect(workbenchReadSource).not.toContain('function decodeMembers(');
    expect(workbenchReadSource).not.toContain('function decodeGroups(');
    expect(workbenchReadSource).toContain('const currentGroups = groups.map');
    expect(workbenchReadSource).toContain('id: group.id');
    expect(workbenchReadSource).toContain('name: group.name');
    expect(workbenchReadSource).toContain('role: group.role');
    expect(workbenchReadSource).toContain('version: group.version');
    expect(workbenchReadSource).not.toContain('groupCode');
  });
});
