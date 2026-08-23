import type { GroupMemberContact } from '@schedule/contracts';

export function createEditableGroupContact(
  contact: GroupMemberContact | undefined,
  canEditMobilePhone: boolean,
): GroupMemberContact | undefined {
  if (contact === undefined || canEditMobilePhone) return contact;
  return {
    isConfirmed: contact.isConfirmed,
    membershipId: contact.membershipId,
    ...(contact.shortPhone === undefined ? {} : { shortPhone: contact.shortPhone }),
    ...(contact.updatedAt === undefined ? {} : { updatedAt: contact.updatedAt }),
    version: contact.version,
  };
}
