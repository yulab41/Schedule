import {
  listGroupContacts,
  listGroupMembers,
  listGroups,
  updateGroupMemberContact,
} from '../../api/endpoints.js';
import { getStoredToken } from '../../api/client.js';
import { getSelectedGroupId, resolveSelectedGroup, setSelectedGroupId } from '../../store/group.js';

interface ContactEditPageData {
  readonly canConfirm: boolean;
  readonly errorMessage: string;
  readonly infoMessage: string;
  readonly isAdminMode: boolean;
  readonly membershipId: string;
  readonly mobilePhone: string;
  readonly realName: string;
  readonly selectedGroupId: string;
  readonly shortPhone: string;
  readonly submitting: boolean;
}

Page({
  data: {
    canConfirm: false,
    errorMessage: '',
    infoMessage: '',
    isAdminMode: false,
    membershipId: '',
    mobilePhone: '',
    realName: '',
    selectedGroupId: '',
    shortPhone: '',
    submitting: false,
  } as ContactEditPageData,

  onLoad(options: Record<string, string | undefined>) {
    const groupId = options.groupId ?? '';
    const membershipId = options.membershipId ?? '';
    const realName = options.realName ?? '';
    this.setData({
      isAdminMode: membershipId.length > 0,
      membershipId,
      realName,
      selectedGroupId: groupId,
    });
  },

  onShow() {
    if (getStoredToken() === undefined) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    void this.loadContext();
  },

  async loadContext(): Promise<void> {
    this.setData({ errorMessage: '' });
    try {
      const groups = await listGroups();
      const selected = resolveSelectedGroup(
        groups,
        this.data.selectedGroupId || getSelectedGroupId(),
      );
      if (selected === undefined) {
        this.setData({ errorMessage: '请先加入一个群组。' });
        return;
      }
      setSelectedGroupId(selected.id);
      let membershipId = this.data.membershipId;
      let realName = this.data.realName;
      let canConfirm = false;
      if (membershipId.length === 0) {
        const members = await listGroupMembers(selected.id);
        const mine = members.find((member) => member.isCurrentUser);
        if (mine !== undefined) {
          membershipId = mine.id;
          realName = mine.realName;
          canConfirm = true;
        }
      } else if (selected.role === 'owner' || selected.role === 'administrator') {
        canConfirm = false;
      }
      const contacts = await listGroupContacts(selected.id);
      const contact = contacts.find((entry) => entry.membershipId === membershipId);
      this.setData({
        canConfirm,
        membershipId,
        mobilePhone: contact?.mobilePhone ?? '',
        realName,
        selectedGroupId: selected.id,
        shortPhone: contact?.shortPhone ?? '',
      });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '联系方式加载失败。') });
    }
  },

  onMobileInput(event: WechatMiniprogram.Input) {
    this.setData({ mobilePhone: event.detail.value });
  },

  onShortInput(event: WechatMiniprogram.Input) {
    this.setData({ shortPhone: event.detail.value });
  },

  async handleSave(): Promise<void> {
    if (this.data.membershipId.length === 0 || this.data.selectedGroupId.length === 0) {
      return;
    }
    this.setData({ errorMessage: '', infoMessage: '', submitting: true });
    try {
      const mobile = this.data.mobilePhone.trim();
      const short = this.data.shortPhone.trim();
      await updateGroupMemberContact(this.data.selectedGroupId, this.data.membershipId, {
        ...(mobile.length > 0 ? { mobilePhone: mobile } : { mobilePhone: null }),
        ...(short.length > 0 ? { shortPhone: short } : { shortPhone: null }),
        ...(this.data.canConfirm ? { confirm: true } : {}),
      });
      wx.showToast({ icon: 'success', title: '联系方式已保存' });
      this.setData({ infoMessage: '联系方式已保存。' });
    } catch (error) {
      this.setData({ errorMessage: toMessage(error, '保存失败。') });
    } finally {
      this.setData({ submitting: false });
    }
  },
});

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback;
}
