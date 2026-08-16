import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('production member contact directory', () => {
  it('uses one contact directory for every active group role and removes the persistent self form', () => {
    const source = readSource('./MemberManager.vue');

    expect(source).toContain('class="self-contact-card"');
    expect(source).toContain('class="member-directory-list"');
    expect(source).toContain("contact?.mobilePhone ?? '未填写'");
    expect(source).toContain("contact?.shortPhone ?? '未填写'");
    expect(source).not.toContain('class="identity-form member-form-card"');
    expect(source).not.toContain('v-else-if="isDeveloperAdmin"');
    expect(source).not.toContain('仅展示成员姓名');
  });

  it('matches contact edit buttons to member, owner, administrator, and developer backend permissions', () => {
    const source = readSource('./MemberManager.vue');
    const contactFormSource = readSource('../profile/GroupContactForm.vue');

    expect(source).toContain("props.group.role === 'owner'");
    expect(source).toContain("props.group.role === 'administrator'");
    expect(source).toContain('isDeveloperAdmin.value');
    expect(source).toContain('return member.isCurrentUser || canManageContacts.value');
    expect(source).toContain(':can-confirm="canManageContacts"');
    expect(source).toContain('member.isPendingRoster !== true');
    expect(contactFormSource).toContain('<strong>确认联系方式</strong>');
    expect(contactFormSource).not.toContain('后台确认联系方式');
  });

  it('closes the responsive editor only after a successful save and reloads the directory', () => {
    const source = readSource('./MemberManager.vue');

    expect(source).toContain('async function handleContactSaved(): Promise<void>');
    expect(source).toMatch(
      /handleContactSaved[\s\S]*editingContactMemberId\.value = undefined;[\s\S]*await loadMembers\(\);/s,
    );
    expect(source).toContain('@saved="handleContactSaved"');
    expect(source).toContain('ResponsiveSheet');
  });

  it('keeps management utilities secondary and matches the approved mobile contact hierarchy', () => {
    const source = readSource('./MemberManager.vue');
    const contactFormSource = readSource('../profile/GroupContactForm.vue');

    expect(source).not.toContain('<h2>成员</h2>');
    expect(source).not.toContain('class="member-count"');
    expect(source).not.toContain('初始状态不显示输入框，需要时再修改。');
    expect(source).toContain('class="roster-sheet-trigger"');
    expect(source).toContain('<button\n              v-if="canAddMembers"');
    expect(source).not.toContain('MoreIcon');
    expect(source).toContain('v-model:visible="rosterEditorVisible"');
    expect(source.indexOf('class="add-member-form"')).toBeGreaterThan(
      source.indexOf('v-model:visible="rosterEditorVisible"'),
    );
    expect(source).toMatch(
      /\.self-avatar\s*{[^}]*color:\s*var\(--ui-color-surface\);[^}]*background:\s*linear-gradient/s,
    );
    expect(source).not.toMatch(
      /\.directory-actions,\s*\.self-contact-card\s*>\s*\.contact-edit-button/s,
    );
    expect(source).toMatch(
      /@media \(max-width:\s*340px\)[\s\S]*?\.directory-contact-values\s*{[^}]*padding-left:\s*0;/s,
    );
    expect(source).toMatch(
      /@media \(max-width:\s*340px\)[\s\S]*?\.member-manage-button\s*{[^}]*display:\s*none;/s,
    );
    expect(contactFormSource).not.toContain('<t-input');
    expect(contactFormSource).not.toContain('<t-checkbox');
    expect(contactFormSource).not.toContain('<t-button');
    expect(contactFormSource).toContain('class="confirmation-row"');
    expect(contactFormSource).toContain('class="contact-save-button"');
  });
});
