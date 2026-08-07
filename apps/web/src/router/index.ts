import { createRouter, createWebHistory } from 'vue-router';

import { pinia } from '../stores/pinia.js';
import { useSessionStore } from '../stores/session.js';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      component: () => import('../views/auth/LoginView.vue'),
      meta: { guestOnly: true },
      name: 'login',
      path: '/login',
    },
    {
      path: '/register',
      redirect: { name: 'login' },
    },
    {
      component: () => import('../views/guest/GuestScheduleView.vue'),
      name: 'guest-schedule',
      path: '/guest',
    },
    {
      component: () => import('../layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      path: '/',
      children: [
        {
          component: () => import('../views/HomeView.vue'),
          name: 'home',
          path: '',
        },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  const session = useSessionStore(pinia);

  if (session.status === 'loading') {
    await session.restore();
  }

  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth === true);
  if (requiresAuth && !session.isAuthenticated && !session.needsProfile) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    };
  }

  const guestOnly = to.matched.some((record) => record.meta.guestOnly === true);
  if (guestOnly && (session.isAuthenticated || session.needsProfile)) {
    return { name: 'home' };
  }

  return true;
});
