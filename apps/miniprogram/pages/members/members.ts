import type { GroupMember, GroupMemberContact, GroupSummary } from '@schedule/contracts';

import { listGroupContacts, listGroupMembers, listGroups } from '../../api/endpoints.js';
import { resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';
import type { DutyPhoneOption } from '../../utils/calendar.js';
import { getConfirmedPhoneOptions } from '../../utils/calendar.js';

interface MemberRow {
  readonly contactConfirmed: boolean;
  readonly id: string;
  readonly isCurrentUser: boolean;
  readonly isPendingRoster: boolean;
  readonly isUnclaimed: boolean;
  readonly phoneOptions: readonly DutyPhoneOption[];
  readonly realName: string;
  readonly roleLabel: string;
  readonly statusLabel: string;
}

interface MembersPageData {
  readonly errorMessage: string;
  readonly groups: readonly GroupSummary[];
  readonly loading: boolean;
  readonly members: readonly MemberRow[];
  readonly selectedGroupId: string;
}

Page({
  data: {
    errorMessage: '',
    groups: [],
    loading: false,
    members: [],
    selectedGroupId: '',
  } as MembersPageData,

  onShow() {
    void this.loadGroups();
  },

  async loadGroups(): Promise<void> {
    this.setData({ errorMessage: '', loading: true });
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(groups);
      this.setData({
        groups,
        selectedGroupId: selected?.id ?? '',
      });
      if (selected !== undefined) {
        setSelectedGroupId(selected.id);
        await this.loadMembers();
      } else {
        this.setData({ members: [] });
      }
    } catch (error) {
      this.setData({
        errorMessage:
          error instanceof Error && error.message.length > 0
            ? error.message
            : '群组数据加载失败，请稍后重试。',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  async loadMembers(): Promise<void> {
    const groupId = this.data.selectedGroupId;
    if (groupId.length === 0) {
      return;
    }
    this.setData({ errorMessage: '', loading: true });
    try {
      const [members, contacts] = await Promise.all([
        listGroupMembers(groupId),
        listGroupContacts(groupId),
      ]);
      const contactsByMembershipId = new Map(
        contacts.map((contact) => [contact.membershipId, contact]),
      );
      this.setData({
        members: members.map((member) => buildMemberRow(member, contactsByMembershipId)),
      });
    } catch (error) {
      this.setData({
        errorMessage:
          error instanceof Error && error.message.length > 0
            ? error.message
            : '成员数据加载失败，请稍后重试。',
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  handleGroupChange(event: WechatMiniprogram.CustomEvent) {
    const groupId = event.detail.groupId;
    if (typeof groupId !== 'string' || groupId.length === 0) {
      return;
    }
    this.setData({ selectedGroupId: groupId });
    setSelectedGroupId(groupId);
    void this.loadMembers();
  },

  handleCall(event: WechatMiniprogram.TouchEvent) {
    const phoneNumber = event.currentTarget.dataset.number;
    if (typeof phoneNumber === 'string' && phoneNumber.length > 0) {
      wx.makePhoneCall({ phoneNumber });
    }
  },
});

function buildMemberRow(
  member: GroupMember,
  contactsByMembershipId: ReadonlyMap<string, GroupMemberContact>,
): MemberRow {
  const contact = contactsByMembershipId.get(member.id);
  const isConfirmed = contact?.isConfirmed === true;
  const phoneOptions = getConfirmedPhoneOptions(
    contact === undefined
      ? undefined
      : {
          isConfirmed,
          membershipId: contact.membershipId,
          realName: member.realName,
          ...(contact.mobilePhone === undefined ? {} : { mobilePhone: contact.mobilePhone }),
          ...(contact.shortPhone === undefined ? {} : { shortPhone: contact.shortPhone }),
        },
  );
  return {
    contactConfirmed: isConfirmed,
    id: member.id,
    isCurrentUser: member.isCurrentUser,
    isPendingRoster: member.isPendingRoster === true,
    isUnclaimed: member.isUnclaimed === true,
    phoneOptions,
    realName: member.realName,
    roleLabel: roleLabel(member.role),
    statusLabel: statusLabel(member),
  };
}

function roleLabel(role: GroupMember['role']): string {
  if (role === 'owner') {
    return '群主';
  }
  return role === 'administrator' ? '管理员' : '成员';
}

function statusLabel(member: GroupMember): string {
  if (member.isPendingRoster === true) {
    return '待认领名单';
  }
  if (member.isUnclaimed === true) {
    return '未认领';
  }
  if (member.isClaimedByCurrentUser === true) {
    return '已认领（我）';
  }
  return '已认领';
}
