import { readInviteToken } from './features/auth/auth-flow.js';
import { initializeAuthRuntime, restoreAndNavigate } from './features/auth/auth-runtime.js';
import { isVisitorGuestLaunch } from './features/visitor/visitor-launch.js';
import { sessionStore } from './store/session.js';

initializeAuthRuntime();

App({
  onLaunch(options): void {
    if (isVisitorGuestLaunch(options.path)) return;
    const inviteToken = readInviteToken(options.query);
    if (inviteToken !== undefined) sessionStore.setPendingInviteToken(inviteToken);
    restoreAndNavigate();
  },
});
