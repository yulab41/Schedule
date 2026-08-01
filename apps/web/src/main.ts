import { createApp } from 'vue';
import { VueQueryPlugin } from '@tanstack/vue-query';
import TDesign from 'tdesign-vue-next';
import 'tdesign-vue-next/es/style/index.css';

import App from './App.vue';
import { router } from './router/index.js';
import { pinia } from './stores/pinia.js';
import './styles/base.css';

createApp(App).use(pinia).use(router).use(VueQueryPlugin).use(TDesign).mount('#app');
