import { onBeforeUnmount, onMounted, ref } from 'vue';

import { isNavigatorOnline } from './offline-guard.js';

export function useOnlineState(): ReturnType<typeof ref<boolean>> {
  const isOnline = ref(isNavigatorOnline());

  function update(): void {
    isOnline.value = isNavigatorOnline();
  }

  onMounted(() => {
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  });

  return isOnline;
}
