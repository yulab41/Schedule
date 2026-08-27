import {
  clearPendingProfileAvatar,
  rememberPendingProfileAvatar,
} from '../../platform/profile-media.js';

interface ChooseAvatarEvent {
  readonly detail?: { readonly avatarUrl?: unknown };
}

interface ProfileAvatarLoginButtonInstance {
  readonly properties: {
    readonly disabled: boolean;
    readonly loading: boolean;
  };
  triggerEvent(name: string, detail?: unknown): void;
}

Component({
  properties: {
    disabled: { type: Boolean, value: false },
    label: { type: String, value: '微信快捷登录' },
    loading: { type: Boolean, value: false },
  },
  methods: {
    handlePress(this: ProfileAvatarLoginButtonInstance): void {
      if (this.properties.disabled || this.properties.loading) return;
      clearPendingProfileAvatar();
      this.triggerEvent('press');
    },

    handleChooseAvatar(this: ProfileAvatarLoginButtonInstance, event: ChooseAvatarEvent): void {
      if (this.properties.disabled || this.properties.loading) return;
      const avatarUrl = event.detail?.avatarUrl;
      if (typeof avatarUrl !== 'string' || avatarUrl.length === 0) return;
      rememberPendingProfileAvatar(avatarUrl);
      this.triggerEvent('avatarselected');
    },
  },
});
