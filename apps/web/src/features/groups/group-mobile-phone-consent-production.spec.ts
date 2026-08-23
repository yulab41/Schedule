import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
}

describe('production group mobile phone consent', () => {
  it('mounts the approved personal consent card for every active non-guest group member', () => {
    const setup = source('./GroupSetupPanel.vue');
    const card = source('./GroupMobilePhoneConsentCard.vue');
    const golden = source('../../stories/miniprogram/P5SchedulingClosurePreview.vue');

    expect(setup).toContain('GroupMobilePhoneConsentCard');
    expect(setup).toContain("props.group.role !== 'guest'");
    for (const copy of [
      '联系方式公开',
      '我的手机号公开设置',
      '仅自己',
      '允许本群组显示完整手机号',
      '管理员不能代替成员授权',
    ]) {
      expect(card).toContain(copy);
      expect(golden).toContain(copy);
    }
    expect(card).toContain('class="contact-member-row"');
    expect(card).toContain('class="phone-consent-control"');
    expect(card).toContain('class="privacy-boundary"');
    expect(card).toContain('class="consent-save"');
  });

  it('covers loading, retry, missing, stale, grant, revoke, saving, and conflict reload', () => {
    const card = source('./GroupMobilePhoneConsentCard.vue');

    expect(card).toContain('正在读取手机号公开设置');
    expect(card).toContain('重新加载');
    expect(card).toContain("status.state === 'missing-phone'");
    expect(card).toContain('号码或说明已变化，需重新同意');
    expect(card).toContain('viewModel.actionLabel');
    expect(card).toContain(':disabled="isSaving || !viewModel.canSave"');
    expect(card).toContain('error instanceof ApiClientError && error.status === 409');
    expect(card).toContain('await loadStatus');
    expect(card).toContain('resolveGroupMobilePhoneConsentSubmission');
    expect(card).toContain('requestSerial');
  });

  it('never exposes or submits another member raw mobile phone from the edit sheet', () => {
    const manager = source('../members/MemberManager.vue');
    const form = source('../profile/GroupContactForm.vue');

    expect(manager).toContain('createEditableGroupContact');
    expect(manager).toContain(
      ':can-edit-mobile-phone="contactEditorMember?.isCurrentUser === true"',
    );
    expect(form).toContain('v-if="canEditMobilePhone"');
    expect(form).toContain('...(props.canEditMobilePhone');
    expect(form).not.toContain(
      '...(props.canConfirm ? { isConfirmed: isConfirmed.value } : {}),\n      mobilePhone:',
    );
  });
});
