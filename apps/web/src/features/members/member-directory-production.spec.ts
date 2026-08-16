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
    expect(contactFormSource).toContain('>确认联系方式</t-checkbox>');
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
});
