import {
  isDefaultPasswordReminderDismissed,
  persistDefaultPasswordReminderDismissal,
} from '../../platform/password-reminder-storage.js';
import type { IdentityAuthMethod } from '../../platform/wechat-identity.js';
import type {
  MiniProgramPasswordStatus,
  ProfilePasswordChangeInput,
} from '../../platform/profile-account.js';

import { getPasswordReminderRuntime } from '../../platform/password-reminder-runtime.js';
export { resetPasswordReminderLaunch } from '../../platform/password-reminder-runtime.js';

export interface AccountSecurityData {
  readonly authMethod: IdentityAuthMethod;
  readonly defaultPasswordReminderOpen: boolean;
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly passwordConfirm: string;
  readonly passwordError: string;
  readonly passwordSaving: boolean;
  readonly passwordSheetOpen: boolean;
}
export interface AccountSecurityInstance {
  data: AccountSecurityData;
  _securityGeneration?: number;
  _editingProfileId?: string | undefined;
  setData(patch: Partial<AccountSecurityData>): void;
}
function releaseEditor(instance: AccountSecurityInstance): void {
  const { activeEditors } = getPasswordReminderRuntime();
  const id = instance._editingProfileId;
  if (id && activeEditors.get(id) === instance) activeEditors.delete(id);
  instance._editingProfileId = undefined;
}
function claimEditor(instance: AccountSecurityInstance, id: string | undefined): boolean {
  const { activeEditors } = getPasswordReminderRuntime();
  if (!id || (activeEditors.has(id) && activeEditors.get(id) !== instance)) return false;
  instance._editingProfileId = id;
  activeEditors.set(id, instance);
  return true;
}
interface InputEvent {
  readonly detail: { readonly value: string };
}
interface Dependencies {
  getProfile(): { readonly id: string } | undefined;
  getAuthMethod(): IdentityAuthMethod | undefined;
  getPasswordStatus(): Promise<MiniProgramPasswordStatus>;
  changePassword(input: ProfilePasswordChangeInput): Promise<{ readonly passwordChanged: true }>;
  finishSensitiveSessionChange(): void;
}
export function createAccountSecurityController(dependencies: Dependencies) {
  return {
    data: {
      authMethod: 'wechat' as IdentityAuthMethod,
      defaultPasswordReminderOpen: false,
      currentPassword: '',
      newPassword: '',
      passwordConfirm: '',
      passwordError: '',
      passwordSaving: false,
      passwordSheetOpen: false,
    } satisfies AccountSecurityData,
    initialize(this: AccountSecurityInstance): void {
      this._securityGeneration = (this._securityGeneration ?? 0) + 1;
    },
    dispose(this: AccountSecurityInstance): void {
      releaseEditor(this);
      this._securityGeneration = (this._securityGeneration ?? 0) + 1;
    },
    async checkReminder(this: AccountSecurityInstance): Promise<void> {
      const { checkedAccounts, activeEditors } = getPasswordReminderRuntime();
      const profileId = dependencies.getProfile()?.id;
      if (
        !profileId ||
        checkedAccounts.has(profileId) ||
        isDefaultPasswordReminderDismissed(profileId)
      )
        return;
      const accounts = checkedAccounts;
      const generation = this._securityGeneration;
      accounts.add(profileId);
      try {
        const status = await dependencies.getPasswordStatus();
        if (
          generation !== this._securityGeneration ||
          dependencies.getProfile()?.id !== profileId
        ) {
          accounts.delete(profileId);
          return;
        }
        this.setData({
          authMethod: dependencies.getAuthMethod() ?? 'wechat',
          defaultPasswordReminderOpen:
            status.mustChangePassword &&
            !activeEditors.has(profileId) &&
            !this.data.passwordSheetOpen,
        });
      } catch {
        // Do not block the workbench or guess that an unreadable password is initial.
        accounts.delete(profileId);
      }
    },
    methods: {
      handleDefaultPasswordReminderClose(this: AccountSecurityInstance): void {
        if (!this.data.passwordSaving) {
          this.setData({ defaultPasswordReminderOpen: false });
        }
      },

      handleDefaultPasswordReminderDismiss(this: AccountSecurityInstance): void {
        const profile = dependencies.getProfile();
        if (profile === undefined || !persistDefaultPasswordReminderDismissal(profile.id)) {
          this.setData({ passwordError: '未能保存“不再提示”，请重试。' });
          return;
        }
        this.setData({ defaultPasswordReminderOpen: false, passwordError: '' });
      },

      handleDefaultPasswordReminderEdit(this: AccountSecurityInstance): void {
        if (!claimEditor(this, dependencies.getProfile()?.id)) return;
        this.setData({ defaultPasswordReminderOpen: false });
        this.setData({
          currentPassword: '',
          newPassword: '',
          passwordConfirm: '',
          passwordError: '',
          passwordSheetOpen: true,
        });
      },

      handleConfirmDialogTap(): void {
        // Keep taps inside the dialog from closing it through the backdrop handler.
      },

      handlePasswordOpen(this: AccountSecurityInstance): void {
        if (this.data.passwordSaving || !claimEditor(this, dependencies.getProfile()?.id)) return;
        this.setData({
          authMethod: dependencies.getAuthMethod() ?? 'wechat',
          currentPassword: '',
          newPassword: '',
          passwordConfirm: '',
          passwordError: '',
          passwordSheetOpen: true,
        });
      },

      handlePasswordClose(this: AccountSecurityInstance): void {
        if (this.data.passwordSaving) return;
        releaseEditor(this);
        this.setData({
          currentPassword: '',
          newPassword: '',
          passwordConfirm: '',
          passwordError: '',
          passwordSheetOpen: false,
        });
      },

      handleCurrentPasswordInput(this: AccountSecurityInstance, event: InputEvent): void {
        this.setData({ currentPassword: event.detail.value, passwordError: '' });
      },

      handleNewPasswordInput(this: AccountSecurityInstance, event: InputEvent): void {
        this.setData({ newPassword: event.detail.value, passwordError: '' });
      },

      handlePasswordConfirmInput(this: AccountSecurityInstance, event: InputEvent): void {
        this.setData({ passwordConfirm: event.detail.value, passwordError: '' });
      },

      handlePasswordSubmit(this: AccountSecurityInstance): void {
        if (this.data.passwordSaving) return;
        if (this._editingProfileId !== dependencies.getProfile()?.id) {
          releaseEditor(this);
          this.setData({
            passwordSheetOpen: false,
            currentPassword: '',
            newPassword: '',
            passwordConfirm: '',
          });
          return;
        }
        const currentPassword = this.data.currentPassword;
        const newPassword = this.data.newPassword;
        if (
          newPassword.length === 0 ||
          this.data.passwordConfirm.length === 0 ||
          newPassword !== this.data.passwordConfirm
        ) {
          this.setData({ passwordError: '请确认两次输入的新密码一致。' });
          return;
        }
        if (this.data.authMethod === 'password' && currentPassword.length === 0) {
          this.setData({ passwordError: '请输入当前密码。' });
          return;
        }
        if (this.data.authMethod === 'password' && currentPassword === newPassword) {
          this.setData({ passwordError: '新密码不能与当前密码相同。' });
          return;
        }
        const input: ProfilePasswordChangeInput =
          this.data.authMethod === 'password'
            ? { authMethod: 'password', currentPassword, newPassword }
            : { authMethod: 'wechat', newPassword };
        const profileId = dependencies.getProfile()?.id;
        const generation = this._securityGeneration;
        const current = () =>
          this._securityGeneration === generation && dependencies.getProfile()?.id === profileId;
        this.setData({ passwordError: '', passwordSaving: true });
        void dependencies
          .changePassword(input)
          .then(() => {
            if (!current()) return;
            this.setData({
              defaultPasswordReminderOpen: false,
              passwordSheetOpen: false,
              currentPassword: '',
              newPassword: '',
              passwordConfirm: '',
            });
            releaseEditor(this);
            dependencies.finishSensitiveSessionChange();
          })
          .catch(
            (error: unknown) =>
              current() &&
              this.setData({
                passwordError:
                  error instanceof Error ? error.message : '密码没有修改，请稍后重试。',
              }),
          )
          .finally(() => {
            if (current()) this.setData({ passwordSaving: false });
          });
      },
    },
  };
}
