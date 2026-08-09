import { readInviteToken } from './features/auth/auth-flow.js';
import { initializeAuthRuntime, restoreAndNavigate } from './features/auth/auth-runtime.js';
import { sessionStore } from './store/session.js';

initializeAuthRuntime();

App({
  onLaunch(options): void {
    const inviteToken = readInviteToken(options.query);
    if (inviteToken !== undefined) sessionStore.setPendingInviteToken(inviteToken);
    restoreAndNavigate();
  },
});
