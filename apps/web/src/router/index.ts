import { createRouter, createWebHistory } from 'vue-router';

import AppLayout from '../layouts/AppLayout.vue';
import { pinia } from '../stores/pinia.js';
import { useSessionStore } from '../stores/session.js';
import HomeView from '../views/HomeView.vue';
import LoginView from '../views/auth/LoginView.vue';
import GuestScheduleView from '../views/guest/GuestScheduleView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      component: LoginView,
      meta: { guestOnly: true },
      name: 'login',
      path: '/login',
    },
    {
      path: '/register',
      redirect: { name: 'login' },
    },
    {
      component: GuestScheduleView,
      name: 'guest-schedule',
      path: '/guest',
    },
    {
      component: AppLayout,
      meta: { requiresAuth: true },
      path: '/',
      children: [
        {
          component: HomeView,
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
