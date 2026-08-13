import {
  getCurrentProfile,
  listGroupContacts,
  listGroupMembers,
  updateGroupMemberContact,
  updateProfile,
} from '../../api/endpoints.js';
import { navigateForCurrentSession } from '../../features/auth/auth-runtime.js';
import { guardMiniprogramRoute } from '../../features/navigation/route-guard.js';
import { createProfileController } from '../../features/profile/profile-controller.js';
import {
  getOwnContactTarget,
  getProfileSurfaceMode,
  loadOwnGroupContacts,
  type ProfileSurfaceMode,
} from '../../features/profile/profile-logic.js';
import { getMiniProgramRuntimeInfo } from '../../features/profile/profile-runtime.js';
import { sessionStore } from '../../store/session.js';

const profileController = createProfileController({
  clearSession: () => sessionStore.clear(),
  getCurrentProfile,
  navigateToLogin: () => wx.reLaunch({ url: '/pages/auth/login/index' }),
  replaceSessionProfile: (profile) => sessionStore.replaceProfile(profile),
  updateProfile,
});

interface ProfileContactViewModel {
  readonly canEdit: boolean;
  readonly groupId: string;
  readonly groupName: string;
  readonly isConfirmed: boolean;
  readonly membershipId: string | undefined;
  readonly mobilePhone: string;
  readonly role: string;
  readonly shortPhone: string;
  readonly state: Awaited<ReturnType<typeof loadOwnGroupContacts>>[number]['state'];
}

interface ProfilePageData {
  readonly activeGroupName: string;
  readonly activeGroupRole: string;
  readonly contacts: readonly ProfileContactViewModel[];
  readonly draftRealName: string;
  readonly errorMessage: string;
  readonly isLoggingOut: boolean;
  readonly isSavingContactIndex: number | undefined;
  readonly isSavingProfile: boolean;
  readonly loading: boolean;
  readonly profile: typeof sessionStore.state.profile;
  readonly profileSurfaceMode: ProfileSurfaceMode;
  readonly runtimeEnvVersion: string;
  readonly runtimeVersion: string;
}

interface ProfilePageMethods {
  handleContactInput(event: {
    readonly currentTarget: {
      readonly dataset: { readonly field?: unknown; readonly index?: unknown };
    };
    readonly detail: { readonly value?: unknown };
  }): void;
  handleLogout(): void;
  handleProfileInput(event: { readonly detail: { readonly value?: unknown } }): void;
  handleSaveContact(event: {
    readonly currentTarget: { readonly dataset: { readonly index?: unknown } };
  }): Promise<void>;
  handleSaveProfile(): Promise<void>;
  syncProfile(): void;
}

let requestVersion = 0;

function contactViewModel(
  summary: Awaited<ReturnType<typeof loadOwnGroupContacts>>[number],
): ProfileContactViewModel {
  const target = getOwnContactTarget(summary);
  return {
    canEdit: target !== undefined,
    groupId: summary.groupId,
    groupName: summary.groupName,
    isConfirmed: summary.contact?.isConfirmed ?? false,
    membershipId: target?.membershipId,
    mobilePhone: summary.contact?.mobilePhone ?? '',
    role: summary.role,
    shortPhone: summary.contact?.shortPhone ?? '',
    state: summary.state,
  };
}

Page<ProfilePageData, ProfilePageMethods>({
  data: {
    activeGroupName: '',
    activeGroupRole: '',
    contacts: [],
    draftRealName: '',
    errorMessage: '',
    isLoggingOut: false,
    isSavingContactIndex: undefined,
    isSavingProfile: false,
    loading: false,
    profile: undefined,
    profileSurfaceMode: 'full',
    runtimeEnvVersion: '未知环境',
    runtimeVersion: '未提供',
  },
  async onShow(): Promise<void> {
    const state = sessionStore.state;
    if (state.status !== 'authenticated' || state.profile === undefined) {
      navigateForCurrentSession();
      return;
    }
    if (
      !guardMiniprogramRoute(state, '/pages/profile/index', {
        hideTabBar: () => wx.hideTabBar({}),
        reLaunch: (options) => wx.reLaunch(options),
        showTabBar: () => wx.showTabBar({}),
        switchTab: (options) => wx.switchTab(options),
      })
    )
      return;

    profileController.activate(state.profile);
    const activeGroup = state.groups.find((group) => group.id === state.activeGroupId);
    const profileSurfaceMode = getProfileSurfaceMode(activeGroup?.role);
    this.setData({
      activeGroupName: activeGroup?.name ?? '',
      activeGroupRole: activeGroup?.role ?? '',
      contacts: [],
      errorMessage: '',
      isSavingContactIndex: undefined,
      loading: false,
      profileSurfaceMode,
      runtimeEnvVersion: '未知环境',
      runtimeVersion: '未提供',
    });
    this.syncProfile();

    const version = ++requestVersion;
    if (profileSurfaceMode === 'guest-minimal') return;
    const runtime = getMiniProgramRuntimeInfo(() => wx.getAccountInfoSync());
    this.setData({
      runtimeEnvVersion: runtime.envVersion,
      runtimeVersion: runtime.version,
    });
    this.setData({ loading: true });
    try {
      const summaries = await loadOwnGroupContacts(state.groups, {
        listGroupContacts,
        listGroupMembers,
      });
      if (version === requestVersion) this.setData({ contacts: summaries.map(contactViewModel) });
    } catch (error) {
      if (version === requestVersion)
        this.setData({
          errorMessage: error instanceof Error ? error.message : '联系人加载失败，请稍后重试。',
        });
    } finally {
      if (version === requestVersion) this.setData({ loading: false });
    }
  },
  handleContactInput(event): void {
    const index = event.currentTarget.dataset.index;
    const field = event.currentTarget.dataset.field;
    if (
      typeof index !== 'number' ||
      (field !== 'mobilePhone' && field !== 'shortPhone') ||
      this.data.contacts[index] === undefined
    )
      return;
    this.setData({
      [`contacts[${index}].${field}`]:
        typeof event.detail.value === 'string' ? event.detail.value : '',
    });
  },
  handleLogout(): void {
    profileController.logout();
    this.syncProfile();
  },
  handleProfileInput(event): void {
    profileController.setDraftRealName(
      typeof event.detail.value === 'string' ? event.detail.value : '',
    );
    this.syncProfile();
  },
  async handleSaveContact(event): Promise<void> {
    const index = event.currentTarget.dataset.index;
    if (typeof index !== 'number' || this.data.isSavingContactIndex !== undefined) return;
    const contact = this.data.contacts[index];
    if (contact === undefined) return;
    const target = getOwnContactTarget({
      ...(contact.state === 'available'
        ? {
            contact: {
              isConfirmed: contact.isConfirmed,
              membershipId: contact.membershipId ?? '',
              ...(contact.mobilePhone.length > 0 ? { mobilePhone: contact.mobilePhone } : {}),
              ...(contact.shortPhone.length > 0 ? { shortPhone: contact.shortPhone } : {}),
              version: 0,
            },
          }
        : {}),
      groupId: contact.groupId,
      groupName: contact.groupName,
      ...(contact.membershipId === undefined ? {} : { membershipId: contact.membershipId }),
      role: contact.role as 'administrator' | 'guest' | 'member' | 'owner',
      state: contact.state,
    });
    if (target === undefined) return;
    this.setData({ errorMessage: '', isSavingContactIndex: index });
    try {
      const updated = await updateGroupMemberContact(target.groupId, target.membershipId, {
        confirm: true,
        mobilePhone: contact.mobilePhone.trim() || null,
        shortPhone: contact.shortPhone.trim() || null,
      });
      const contacts = this.data.contacts.map((entry, entryIndex) =>
        entryIndex === index
          ? {
              ...entry,
              isConfirmed: updated.isConfirmed,
              mobilePhone: updated.mobilePhone ?? '',
              shortPhone: updated.shortPhone ?? '',
              state: 'available' as const,
            }
          : entry,
      );
      this.setData({ contacts });
    } catch (error) {
      this.setData({
        errorMessage: error instanceof Error ? error.message : '联系方式暂时无法保存，请稍后重试。',
      });
    } finally {
      this.setData({ isSavingContactIndex: undefined });
    }
  },
  async handleSaveProfile(): Promise<void> {
    try {
      const operation = profileController.saveProfile();
      this.syncProfile();
      await operation;
    } catch {
      // The controller retains the server message and latest profile on conflict.
    }
    this.syncProfile();
  },
  syncProfile(): void {
    const state = profileController.state;
    this.setData({
      draftRealName: state.draftRealName,
      errorMessage: state.errorMessage ?? this.data.errorMessage,
      isLoggingOut: state.isLoggingOut,
      isSavingProfile: state.isSaving,
      profile: state.profile,
    });
  },
});
