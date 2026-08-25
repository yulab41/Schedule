import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

describe('P8 organization parity Storybook golden', () => {
  it('renders every production organization surface instead of simplified duplicates', () => {
    const preview = read('./P8OrganizationParityPreview.vue');
    const storybookPreview = read('../../../.storybook/preview.ts');
    const storybookStyles = read('../../../.storybook/storybook.css');

    for (const productionComponent of [
      'GroupSetupPanel',
      'MemberManager',
      'SchedulingConfigPanel',
      'PlatformAdminUsersView',
    ]) {
      expect(preview).toContain(`import ${productionComponent}`);
      expect(preview).toContain(`<${productionComponent}`);
    }
    expect(preview).toContain('P8InviteVisitorGolden');
    expect(preview).not.toContain('class="organization-card"');
    expect(preview).toContain("waitForExistingElement<HTMLButtonElement>('.member-manage-button')");
    expect(storybookPreview).toContain("import { createPinia } from 'pinia'");
    expect(storybookPreview).toContain('app.use(createPinia())');
    expect(storybookStyles).toContain('body:has(.p8-organization-preview)');
  });

  it('freezes roles, required states, 390/320, and a large-text boundary', () => {
    const fixtures = read('./p8-organization-parity-fixtures.ts');
    const stories = read('./P8OrganizationParityPreview.stories.ts');

    for (const role of ['owner', 'administrator', 'member', 'developer', 'platform-admin']) {
      expect(fixtures).toContain(`'${role}'`);
    }
    for (const surface of [
      'ready',
      'loading',
      'empty',
      'error',
      'conflict',
      'confirm',
      'success',
      'disabled',
    ]) {
      expect(fixtures).toContain(`'${surface}'`);
    }
    for (const area of ['group', 'members', 'config', 'invite-visitor', 'platform']) {
      expect(fixtures).toContain(`'${area}'`);
    }
    expect(stories).toContain("title: 'Miniprogram Parity/P8 Organization Parity'");
    expect(stories).toContain("viewport: 'mobile390'");
    expect(stories.match(/viewport: 'mobile320'/gu)?.length ?? 0).toBeGreaterThanOrEqual(8);
    expect(stories).toContain('largeText: true');
    expect(stories).toContain('GroupOwner390');
    expect(stories).toContain('MembersAdministrator390');
    expect(stories).toContain('ConfigConflict320');
    expect(stories).toContain('InviteVisitorOwner390');
    expect(stories).toContain('PlatformLinkSuccess390');
  });

  it('keeps invitation and visitor secrets out of fixtures and marks capability boundaries', () => {
    const preview = read('./P8InviteVisitorGolden.vue');
    const fixtures = read('./p8-organization-parity-fixtures.ts');

    expect(preview).toContain('邀请链接只显示一次');
    expect(preview).toContain('群主专属');
    expect(preview).toContain('guest capability');
    expect(preview).toContain('organization capability');
    expect(fixtures).not.toMatch(/visitorKey\s*:/u);
    expect(fixtures).not.toMatch(/rawTicket\s*:/u);
    expect(fixtures).not.toMatch(/localStorage|sessionStorage|setItem/gu);
  });

  it('uses contrast-safe tokens for the permission wristband and reused group labels', () => {
    const preview = read('./P8OrganizationParityPreview.vue');
    const groupSetup = read('../../features/groups/GroupSetupPanel.vue');
    const mobileConsent = read('../../features/groups/GroupMobilePhoneConsentCard.vue');
    const schedulingConfig = read('../../features/scheduling-config/SchedulingConfigPanel.vue');
    const inviteVisitor = read('./P8InviteVisitorGolden.vue');
    const platformUsers = read('../../views/platform/PlatformAdminUsersView.vue');

    expect(preview).toContain('<div class="p8-production-surface">');
    expect(preview).not.toContain('<main class="p8-production-surface">');
    expect(preview).toMatch(
      /\.p8-permission-wristband span,[\s\S]*?\.p8-permission-wristband dt\s*{[^}]*color:\s*var\(--ui-color-text-secondary\);/s,
    );
    expect(groupSetup).toMatch(
      /\.group-panel-heading > span\s*{[^}]*color:\s*var\(--ui-color-text-secondary\);/s,
    );
    expect(groupSetup).toMatch(
      /\.group-identity-copy span,[\s\S]*?\.created-group-code > span\s*{[^}]*color:\s*var\(--ui-color-text-secondary\);/s,
    );
    expect(groupSetup).toMatch(
      /\.preference-scope\.is-personal\s*{[^}]*color:\s*var\(--ui-color-text-primary\);/s,
    );
    expect(mobileConsent).toMatch(
      /\.preference-scope\.is-personal\s*{[^}]*color:\s*var\(--ui-color-text-primary\);/s,
    );
    expect(groupSetup).toContain(
      '.current-group-card :deep(.t-button--theme-danger.t-button--variant-outline)',
    );
    expect(schedulingConfig).toMatch(
      /\.config-panel-heading > span\s*{[^}]*color:\s*var\(--ui-color-text-secondary\);/s,
    );
    expect(schedulingConfig).toMatch(
      /\.configuration-readiness > header small\s*{[^}]*color:\s*var\(--ui-color-text-secondary\);/s,
    );
    expect(schedulingConfig).not.toMatch(
      /\.shift-type-row\.is-disabled \.shift-glyph\s*{[^}]*opacity:/s,
    );
    expect(schedulingConfig).toContain(
      '.scheduling-config-panel :deep(.t-alert--error .t-alert__description)',
    );
    expect(schedulingConfig).toContain('.scheduling-config-panel :deep(.t-button--theme-danger)');
    expect(inviteVisitor).toMatch(
      /\.invite-summary dt\s*{[^}]*color:\s*var\(--ui-color-text-secondary\);/s,
    );
    expect(inviteVisitor).toMatch(
      /\.scope-badge\.is-owner\s*{[^}]*color:\s*var\(--ui-color-text-primary\);/s,
    );
    expect(inviteVisitor).toMatch(
      /\.access-feedback\s*{[^}]*color:\s*var\(--ui-color-text-primary\);/s,
    );
    expect(platformUsers).toMatch(/th\s*{[^}]*color:\s*var\(--ui-color-text-secondary\);/s);
  });

  it('registers exact P8 story ids in the golden manifest', () => {
    const manifest = read('../../../../miniprogram/docs/design/page-golden-manifest.md');

    for (const id of [
      'miniprogram-parity-p8-organization-parity--group-owner-390',
      'miniprogram-parity-p8-organization-parity--members-manage-confirm-320',
      'miniprogram-parity-p8-organization-parity--config-conflict-320',
      'miniprogram-parity-p8-organization-parity--invite-visitor-owner-390',
      'miniprogram-parity-p8-organization-parity--platform-link-success-390',
      'miniprogram-parity-p8-organization-parity--organization-large-text-390',
    ]) {
      expect(manifest).toContain(id);
    }
    expect(manifest).toContain('P8-B');
    expect(manifest).toContain('390 全状态已固化');
    expect(manifest).toContain('320/大字号边界已固化');
  });
});
