import type { GroupMemberContact } from '@schedule/contracts';
import { describe, expect, it } from 'vitest';

import { createEditableGroupContact } from './member-contact-edit.js';

describe('member contact edit boundary', () => {
  it('does not read or pass another member mobile phone into the editor', () => {
    let mobilePhoneRead = false;
    const contact = {
      isConfirmed: true,
      membershipId: 'membership-2',
      shortPhone: '6618',
      version: 4,
    } as GroupMemberContact;
    Object.defineProperty(contact, 'mobilePhone', {
      enumerable: true,
      get() {
        mobilePhoneRead = true;
        throw new Error('another member mobile phone must not be read');
      },
    });

    expect(createEditableGroupContact(contact, false)).toEqual({
      isConfirmed: true,
      membershipId: 'membership-2',
      shortPhone: '6618',
      version: 4,
    });
    expect(mobilePhoneRead).toBe(false);
  });

  it('keeps the current member contact object intact for self editing', () => {
    const contact: GroupMemberContact = {
      isConfirmed: false,
      membershipId: 'membership-1',
      mobilePhone: '13812347926',
      shortPhone: '6618',
      version: 2,
    };

    expect(createEditableGroupContact(contact, true)).toBe(contact);
  });
});
