const defaultPasswordReminderDismissedPrefix = 'schedule.password-reminder.dismissed:';

export function isDefaultPasswordReminderDismissed(profileId: string): boolean {
  try {
    return wx.getStorageSync(`${defaultPasswordReminderDismissedPrefix}${profileId}`) === 'true';
  } catch {
    return false;
  }
}

export function persistDefaultPasswordReminderDismissal(profileId: string): boolean {
  try {
    wx.setStorageSync(`${defaultPasswordReminderDismissedPrefix}${profileId}`, 'true');
    return true;
  } catch {
    return false;
  }
}
