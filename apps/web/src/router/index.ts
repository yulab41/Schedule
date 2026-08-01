import { createRouter, createWebHistory } from 'vue-router';

import AppLayout from '../layouts/AppLayout.vue';
import { pinia } from '../stores/pinia.js';
import { useSessionStore } from '../stores/session.js';
import HomeView from '../views/HomeView.vue';
import LoginView from '../views/auth/LoginView.vue';
import RegisterView from '../views/auth/RegisterView.vue';

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
      component: RegisterView,
      meta: { guestOnly: true },
      name: 'register',
      path: '/register',
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
