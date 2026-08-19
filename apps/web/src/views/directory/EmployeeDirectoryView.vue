<script setup lang="ts">
import { createApiClient } from '../../api/client.js';
import { localAuth } from '../../auth/local-auth.js';
import InternalDirectoryView, { type DirectoryDataSource } from './InternalDirectoryView.vue';

const props = defineProps<{
  readonly group: import('@schedule/contracts').GroupSummary;
}>();

const api = createApiClient({ auth: localAuth });
const employeeDirectoryDataSource: DirectoryDataSource = {
  getDirectoryFacets: (groupId) => api.getEmployeeDirectoryFacets(groupId),
  lookupDirectoryEntries: (groupId, entryIds) =>
    api.lookupEmployeeDirectoryEntries(groupId, entryIds),
  searchDirectory: (groupId, query) => api.searchEmployeeDirectory(groupId, query),
};
</script>

<template>
  <InternalDirectoryView
    :data-source="employeeDirectoryDataSource"
    directory-kind="employee"
    :group="props.group"
    title="员工通讯录"
  />
</template>
