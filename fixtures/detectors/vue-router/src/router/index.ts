import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import LoginView from '@/views/LoginView.vue';
import SettingsLayout from '@/views/SettingsLayout.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/orders', name: 'orders', component: () => import('@/views/OrdersView.vue') },
    { path: '/orders/:id(\\d+)', name: 'order', component: () => import('../views/OrderView.vue') },
    {
      path: '/settings',
      component: SettingsLayout,
      children: [
        { path: '', name: 'settings-profile', component: () => import('@/views/settings/ProfileView.vue') },
        { path: 'password', name: 'settings-password', component: () => import('@/views/settings/PasswordView.vue') },
      ],
    },
    { path: '/home', redirect: '/' },
    { path: '/:pathMatch(.*)*', component: () => import('@/views/NotFound.vue') },
  ],
});

export default router;
