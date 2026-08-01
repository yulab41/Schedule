<template>
  <section class="home-view">
    <h1>排班工作台</h1>
    <p>创建群组并预建待认领人员，或使用四位群组码认领自己的成员身份。</p>
    <GroupSetupPanel />
  </section>
</template>

<script setup lang="ts">
import GroupSetupPanel from '../features/groups/GroupSetupPanel.vue';
</script>
