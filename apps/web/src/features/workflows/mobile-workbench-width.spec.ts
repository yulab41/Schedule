import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('mobile workbench full-width layout', () => {
  it('stacks leave and shift workflow headings across the available mobile width', () => {
    const leavePanel = readSource('../leaves/LeavePanel.vue');
    const workflowPanel = readSource('./workflow-panel.css');

    expect(leavePanel).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.panel-heading\s*{[^}]*display:\s*grid;[^}]*width:\s*100%;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s,
    );
    expect(leavePanel).toMatch(/\.panel-heading :deep\(\.t-button\)\s*{[^}]*width:\s*100%;/s);
    expect(leavePanel).not.toContain('max-width: 220px');

    expect(workflowPanel).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.workflow-panel-heading\s*{[^}]*display:\s*grid;[^}]*width:\s*100%;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s,
    );
    expect(workflowPanel).toMatch(
      /\.workflow-heading-actions\s*{[^}]*width:\s*100%;[^}]*max-width:\s*none;/s,
    );
    expect(workflowPanel).not.toContain('max-width: 210px');
    expect(workflowPanel).not.toContain('max-width: 150px');
  });

  it('lets the member heading fill the mobile page instead of waiting for a 360px breakpoint', () => {
    const memberManager = readSource('../members/MemberManager.vue');

    expect(memberManager).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.member-heading,[\s\S]*?\.section-heading\s*{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s,
    );
    expect(memberManager).not.toContain('max-width: 230px');
  });

  it('keeps compact group-code digits clustered from the left edge', () => {
    const groupPanel = readSource('../groups/GroupSetupPanel.vue');

    expect(groupPanel).toMatch(
      /@media \(max-width: 360px\)[\s\S]*?\.group-code-digits\s*{[^}]*justify-content:\s*flex-start;/s,
    );
    expect(groupPanel).not.toMatch(
      /@media \(max-width: 360px\)[\s\S]*?\.group-code-digits\s*{[^}]*justify-content:\s*space-between;/s,
    );
  });
});
