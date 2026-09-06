const defaultPasswordReminderDismissedPrefix = 'schedule.password-reminder.dismissed:';

export function isDefaultPasswordReminderDismissed(profileId: string): boolean {
  try {
    return wx.getStorageSync(`${defaultPasswordReminderDismissedPrefix}${profileId}`) === 'true';
  } catch {
    return false;
  }
}

export function persistDefaultPasswordReminderDismissal(profileId: string): void {
  try {
    wx.setStorageSync(`${defaultPasswordReminderDismissedPrefix}${profileId}`, 'true');
  } catch {
    // Dismissal is best effort; the current session still closes the prompt.
  }
}
