import { createApp } from 'vue';
import { VueQueryPlugin } from '@tanstack/vue-query';

import App from './App.vue';
import { router } from './router/index.js';
import { pinia } from './stores/pinia.js';
import { registerServiceWorker } from './register-service-worker.js';
import './styles/base.css';

createApp(App).use(pinia).use(router).use(VueQueryPlugin).mount('#app');

void registerServiceWorker();
