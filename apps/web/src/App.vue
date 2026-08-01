<script setup lang="ts">
import type { SystemStatus } from '@schedule/contracts';

const status: SystemStatus = {
  component: 'web',
  ready: true,
  summary: 'Workspace initialization complete.',
};
</script>

<template>
  <main>
    <h1>医护排班系统</h1>
    <p>{{ status.summary }}</p>
  </main>
</template>
