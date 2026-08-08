# 群组管理（访客加入/退出/重加入、改名改码、解散恢复）与成员事件入口隐藏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让登录用户可选访客/成员身份加入群组、自助退出并重新加入，群主可改名/改码/解散/恢复群组，普通成员隐藏“事件”导航入口。

**Architecture:** 复用现有 `group_memberships` 表（新增 `guest` 角色）与“未认领占位身份”机制（`users.cloudbase_uid IS NULL`）；成员退出时把成员身份改绑到占位用户以保留历史，访客退出时软删除访客身份；解散复用现有 `groups.deleted_at` 软删除并在 30 天内由原群主恢复；事件隐藏仅改前端导航过滤。

**Tech Stack:** TypeScript、Fastify、Drizzle ORM、MySQL 迁移、Zod、Vue 3、TDesign Vue Next、Vitest、Playwright（冒烟）。

---

## 文件结构

新增/修改文件与职责：

- `migrations/0032_add_guest_membership_role.sql`：`group_memberships.role` 增加 `guest`。
- `migrations/meta/_journal.json`：登记 0032。
- `packages/database/src/schema/index.ts`：Drizzle 角色枚举增加 `guest`。
- `packages/database/tests/migrations.test.ts`：迁移计数与 guest 角色锁定测试。
- `packages/contracts/src/groups.ts`：`groupRoleSchema` 增加 `guest`；新增 catalog/join-guest/leave/dissolved/restore/update-name schema。
- `packages/contracts/src/groups.test.ts`：契约锁定测试。
- `apps/api/src/modules/groups/permission-service.ts`：新增 `updateGroupName`、`restoreGroup`、`viewGuestCalendar` 与 guest 权限映射。
- `apps/api/src/modules/groups/group-routes.ts`：新增 catalog、join-guest、leave、name、dissolved、restore、guest-calendar 路由。
- `apps/api/src/modules/groups/group-service.ts`：`updateGroupName`、`listDissolvedGroups`、`restoreGroup`。
- `apps/api/src/modules/groups/membership-service.ts`：`joinAsGuest`、`leaveGroup`；`listGroups` 对 guest 剥离 `groupCode`。
- `apps/api/src/modules/calendar/calendar-query.ts`：`readGuestMonthForGroup` 提升为可复用（公开访客月历组装），供 guest-calendar 接口使用。
- `apps/api/src/modules/groups/group-routes.integration.test.ts`、`group-permissions.integration.test.ts`：新行为集成测试。
- `apps/web/src/api/client.ts`：新增 catalog、joinGuest、leave、updateGroupName、listDissolvedGroups、restoreGroup、getGroupGuestCalendar 方法。
- `apps/web/src/api/client.test.ts`：新方法契约测试。
- `apps/web/src/features/layout/workbench-nav.ts`：`events` 改 `requiresAdministrator: true`；访客只显示日历/群组管理。
- `apps/web/src/features/layout/workbench-nav.spec.ts`：角色过滤测试。
- `apps/web/src/features/groups/GroupSwitcher.vue`：访客标签。
- `apps/web/src/features/groups/GroupSetupPanel.vue`：加入下拉/身份选择、退出、群主改名/改码/解散/恢复。
- `apps/web/src/features/groups/GuestCalendarPanel.vue`（新建）：登录后访客简化日历。
- `apps/web/src/views/HomeView.vue`：访客渲染 `GuestCalendarPanel`；导出按钮仅群主/管理员；向 `GroupSetupPanel` 传当前群组。
- `scripts/smoke-browser.mjs`：访客加入/退出、成员退出未认领、群主改名/改码/解散/恢复、成员无事件导航断言。
- `docs/project-status.md`：实施进度与下一批任务。

## 跨对话实施批次

按 `AGENTS.md`，每轮只实施 1–3 个任务：

- 批次 A：任务 1（迁移）、任务 2（契约）、任务 3（后端群组自助服务）。
- 批次 B：任务 4（guest-calendar 与代码剥离）、任务 5（Web client）、任务 6（导航/访客工作台）。
- 批次 C：任务 7（GroupSetupPanel 重构）、任务 8（冒烟与文档收尾）。

每个任务独立验证、独立提交；未跑浏览器冒烟的轮次只能标“已实现待浏览器复核”。

## 通用验证命令

- 契约/数据库改动后：`pnpm --filter @schedule/contracts build`、`pnpm --filter @schedule/database build`。
- 全量：`pnpm verify`（格式 + lint + build + typecheck + 单测，隔离 MySQL）。
- 浏览器：`pnpm smoke:browser`；提交前 `pnpm smoke:check-core`。
- 迁移：`pnpm --filter @schedule/api migrate`；上线必须先迁移线上库再部署代码。

---

### Task 1: 数据库迁移 0032 与 Drizzle 枚举

**Files:**

- Create: `migrations/0032_add_guest_membership_role.sql`
- Modify: `migrations/meta/_journal.json`
- Modify: `packages/database/src/schema/index.ts:126`
- Test: `packages/database/tests/migrations.test.ts`

- [ ] **Step 1: 先改失败测试**

把 `packages/database/tests/migrations.test.ts` 中迁移计数 `expect(migrations).toEqual([{ count: 31 }])` 改为 `32`，并新增：

```ts
it('accepts the guest membership role after migration 0032', async () => {
  await migrateDatabase(client, migrationsDirectory);
  const ownerId = randomUUID();
  const groupId = randomUUID();
  await client.database.execute(sql`INSERT INTO users (id) VALUES (${ownerId})`);
  await client.database.execute(sql`
    INSERT INTO groups (id, name, group_code, owner_user_id)
    VALUES (${groupId}, 'Guest Group', '1234', ${ownerId})
  `);
  await client.database.execute(sql`
    INSERT INTO group_memberships (id, group_id, user_id, role)
    VALUES (${randomUUID()}, ${groupId}, ${ownerId}, 'guest')
  `);
});
```

- [ ] **Step 2: 运行确认失败**

```bash
pnpm --filter @schedule/database test -- migrations
```

预期：`expect(migrations).toEqual([{ count: 31 }])` 失败（实际 32），guest 插入因枚举不含 `guest` 而失败。

- [ ] **Step 3: 写迁移与枚举**

`migrations/0032_add_guest_membership_role.sql`：

```sql
ALTER TABLE `group_memberships`
  MODIFY COLUMN `role`
    ENUM('owner', 'administrator', 'member', 'guest')
    NOT NULL DEFAULT 'member';
```

`migrations/meta/_journal.json` 追加：

```json
{
  "idx": 31,
  "version": "7",
  "when": 1785542400031,
  "tag": "0032_add_guest_membership_role",
  "breakpoints": true
}
```

`packages/database/src/schema/index.ts:126` 改为：

```ts
role: mysqlEnum('role', ['owner', 'administrator', 'member', 'guest'])
  .default('member')
  .notNull(),
```

- [ ] **Step 4: 运行确认通过**

```bash
pnpm --filter @schedule/database build
pnpm --filter @schedule/database test -- migrations
```

预期：全部通过，迁移计数为 32，guest 可写入。

- [ ] **Step 5: 提交**

```bash
git add migrations/0032_add_guest_membership_role.sql migrations/meta/_journal.json packages/database/src/schema/index.ts packages/database/tests/migrations.test.ts
git commit -m "feat(database): add guest membership role migration 0032"
```

---

### Task 2: 契约类型与 schema

**Files:**

- Modify: `packages/contracts/src/groups.ts`
- Test: `packages/contracts/src/groups.test.ts`（新建）

- [ ] **Step 1: 先写失败测试**

新建 `packages/contracts/src/groups.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import {
  groupCatalogEntrySchema,
  groupCatalogRelationSchema,
  groupRoleSchema,
  updateGroupNameRequestSchema,
} from './groups.js';

describe('group membership contracts', () => {
  it('accepts guest in the role enum', () => {
    expect(groupRoleSchema.safeParse('guest').success).toBe(true);
  });

  it('rejects unknown catalog relations', () => {
    expect(groupCatalogRelationSchema.safeParse('banned').success).toBe(false);
  });

  it('rejects extra fields in catalog entries', () => {
    expect(
      groupCatalogEntrySchema.safeParse({
        id: 'g1',
        name: '内科',
        relation: 'none',
        groupCode: '1234',
      }).success,
    ).toBe(false);
  });

  it('rejects empty group names in update requests', () => {
    expect(updateGroupNameRequestSchema.safeParse({ name: '  ' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: 运行确认失败**

```bash
pnpm --filter @schedule/contracts test -- groups.test
```

预期：`groupRoleSchema`/catalog schema 不存在或未包含 guest，编译失败。

- [ ] **Step 3: 写契约**

`packages/contracts/src/groups.ts`：

```ts
export const groupRoleSchema = z.enum(['administrator', 'member', 'owner', 'guest']);

export const groupSummarySchema = z
  .object({
    groupCode: z
      .string()
      .regex(/^\d{4}$/u)
      .optional(),
    id: z.string().min(1),
    name: z.string().min(1),
    role: groupRoleSchema,
    version: z.number().int().min(1),
  })
  .strict();

export const groupCatalogRelationSchema = z.enum([
  'none',
  'active-member',
  'active-guest',
  'left-member',
]);
export type GroupCatalogRelation = z.infer<typeof groupCatalogRelationSchema>;

export const groupCatalogEntrySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    relation: groupCatalogRelationSchema,
  })
  .strict();
export type GroupCatalogEntry = z.infer<typeof groupCatalogEntrySchema>;

export const groupCatalogListSchema = z.array(groupCatalogEntrySchema);

export const updateGroupNameRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
  })
  .strict();
export type UpdateGroupNameRequest = z.infer<typeof updateGroupNameRequestSchema>;

export const dissolvedGroupSchema = z
  .object({
    deletedAt: z.string(),
    id: z.string().min(1),
    name: z.string().min(1),
  })
  .strict();
export type DissolvedGroup = z.infer<typeof dissolvedGroupSchema>;

export const dissolvedGroupListSchema = z.array(dissolvedGroupSchema);
```

`packages/contracts/src/index.ts` 无需修改（已 `export * from './groups.js'`）。

- [ ] **Step 4: 运行确认通过**

```bash
pnpm --filter @schedule/contracts build
pnpm --filter @schedule/contracts test -- groups.test
```

- [ ] **Step 5: 提交**

```bash
git add packages/contracts/src/groups.ts packages/contracts/src/groups.test.ts
git commit -m "feat(contracts): guest role, group catalog, name and dissolved schemas"
```

---

### Task 3: 后端群组自助服务（权限、catalog、访客加入/退出、成员退出、改名、解散列表、恢复）

**Files:**

- Modify: `apps/api/src/modules/groups/permission-service.ts`
- Modify: `apps/api/src/modules/groups/group-routes.ts`
- Modify: `apps/api/src/modules/groups/group-service.ts`
- Modify: `apps/api/src/modules/groups/membership-service.ts`
- Test: `apps/api/src/modules/groups/group-routes.integration.test.ts`
- Test: `apps/api/src/modules/groups/group-permissions.integration.test.ts`

- [ ] **Step 1: 先写失败集成测试**

在 `group-routes.integration.test.ts` 新增：

```ts
it('supports guest join, leave, and member leave/rejoin', async () => {
  const group = await createGroup('Membership group', '3456');
  const groupId = (group.json() as { id: string }).id;
  await app.inject({
    headers: { authorization: 'Bearer owner-token' },
    method: 'POST',
    payload: { realNames: ['Candidate Doctor'] },
    url: `/groups/${groupId}/roster-entries`,
  });

  const guestJoin = await app.inject({
    headers: { authorization: 'Bearer outsider-token' },
    method: 'POST',
    url: `/groups/${groupId}/join-guest`,
  });
  expect(guestJoin.statusCode).toBe(201);

  const guestLeave = await app.inject({
    headers: { authorization: 'Bearer outsider-token' },
    method: 'POST',
    url: `/groups/${groupId}/leave`,
  });
  expect(guestLeave.statusCode).toBe(204);

  const memberClaim = await app.inject({
    headers: { authorization: 'Bearer candidate-token' },
    method: 'POST',
    payload: { groupCode: '3456', realName: 'Candidate Doctor' },
    url: '/groups/claim',
  });
  expect(memberClaim.statusCode).toBe(201);

  const memberLeave = await app.inject({
    headers: { authorization: 'Bearer candidate-token' },
    method: 'POST',
    url: `/groups/${groupId}/leave`,
  });
  expect(memberLeave.statusCode).toBe(204);

  const members = await app.inject({
    headers: { authorization: 'Bearer owner-token' },
    method: 'GET',
    url: `/groups/${groupId}/members`,
  });
  const memberRows = members.json() as Array<{ isUnclaimed?: boolean; realName: string }>;
  expect(memberRows.find((row) => row.realName === 'Candidate Doctor')?.isUnclaimed).toBe(true);

  const rejoin = await app.inject({
    headers: { authorization: 'Bearer candidate-token' },
    method: 'POST',
    payload: { groupCode: '3456', realName: 'Candidate Doctor' },
    url: '/groups/claim',
  });
  expect(rejoin.statusCode).toBe(201);
  expect((rejoin.json() as { group: { role: string } }).group.role).toBe('member');
});

it('rejects owner leave and non-owner group name changes', async () => {
  const group = await createGroup('Owner group', '4567');
  const groupId = (group.json() as { id: string }).id;

  const ownerLeave = await app.inject({
    headers: { authorization: 'Bearer owner-token' },
    method: 'POST',
    url: `/groups/${groupId}/leave`,
  });
  expect(ownerLeave.statusCode).toBe(409);

  const adminRename = await app.inject({
    headers: { authorization: 'Bearer other-owner-token' },
    method: 'PUT',
    payload: { name: 'Renamed by outsider' },
    url: `/groups/${groupId}/name`,
  });
  expect(adminRename.statusCode).toBe(403);

  const ownerRename = await app.inject({
    headers: { authorization: 'Bearer owner-token' },
    method: 'PUT',
    payload: { name: 'Renamed group' },
    url: `/groups/${groupId}/name`,
  });
  expect(ownerRename.statusCode).toBe(200);
  expect((ownerRename.json() as { name: string }).name).toBe('Renamed group');
});

it('supports dissolve and restore by the owner', async () => {
  const group = await createGroup('Dissolve group', '5678');
  const groupId = (group.json() as { id: string }).id;

  const dissolve = await app.inject({
    headers: { authorization: 'Bearer owner-token' },
    method: 'DELETE',
    url: `/groups/${groupId}`,
  });
  expect(dissolve.statusCode).toBe(204);

  const dissolved = await app.inject({
    headers: { authorization: 'Bearer owner-token' },
    method: 'GET',
    url: '/groups/dissolved',
  });
  expect(dissolved.statusCode).toBe(200);
  expect(dissolved.json()).toHaveLength(1);

  const restore = await app.inject({
    headers: { authorization: 'Bearer owner-token' },
    method: 'POST',
    url: `/groups/${groupId}/restore`,
  });
  expect(restore.statusCode).toBe(204);

  const afterRestore = await app.inject({
    headers: { authorization: 'Bearer owner-token' },
    method: 'GET',
    url: `/groups/${groupId}/members`,
  });
  expect(afterRestore.statusCode).toBe(200);
});
```

在 `group-permissions.integration.test.ts` 新增：

```ts
it('hides group codes from guest group summaries', async () => {
  const group = await createGroup('Guest code group', '6789');
  const groupId = (group.json() as { id: string }).id;
  await app.inject({
    headers: { authorization: 'Bearer outsider-token' },
    method: 'POST',
    url: `/groups/${groupId}/join-guest`,
  });
  const groups = await app.inject({
    headers: { authorization: 'Bearer outsider-token' },
    method: 'GET',
    url: '/groups',
  });
  const summary = (groups.json() as Array<{ groupCode?: string; role: string }>)[0];
  expect(summary?.role).toBe('guest');
  expect(summary?.groupCode).toBeUndefined();
});
```

- [ ] **Step 2: 运行确认失败**

```bash
pnpm --filter @schedule/api test -- group-routes.integration
```

预期：404（路由不存在）或 403（权限缺失）。

- [ ] **Step 3: 实现权限**

`apps/api/src/modules/groups/permission-service.ts`：

```ts
export type GroupPermission =
  | 'deleteGroup'
  | 'manageDutyAdjustments'
  | 'manageAdministrators'
  | 'manageContacts'
  | 'manageLeaves'
  | 'manageMembers'
  | 'manageNotifications'
  | 'manageRoster'
  | 'manageScheduleConfiguration'
  | 'manageSwaps'
  | 'regenerateGroupCode'
  | 'restoreGroup'
  | 'transferOwnership'
  | 'updateGroupName'
  | 'viewContacts'
  | 'viewGuestCalendar'
  | 'viewMembers'
  | 'viewScheduleConfiguration';
```

权限映射追加：

```ts
administrator: [/* 保持现有 */],
guest: ['viewGuestCalendar'],
member: [/* 保持现有 */],
owner: [
  /* 保持现有 */
  'restoreGroup',
  'updateGroupName',
],
```

- [ ] **Step 4: 实现路由**

`apps/api/src/modules/groups/group-routes.ts` 在 `registerGroupRoutes` 内追加：

```ts
app.get('/groups/catalog', { preHandler: app.authenticate }, async (request) =>
  membershipService.listCatalog(getAuthenticatedIdentity(request)),
);

app.post(
  '/groups/:groupId/join-guest',
  { preHandler: app.authenticate },
  async (request, reply) => {
    const group = await membershipService.joinAsGuest(
      getAuthenticatedIdentity(request),
      parseGroupId(request),
    );
    return reply.code(201).send(group);
  },
);

app.post('/groups/:groupId/leave', { preHandler: app.authenticate }, async (request, reply) => {
  await membershipService.leaveGroup(getAuthenticatedIdentity(request), parseGroupId(request));
  return reply.code(204).send();
});

app.put('/groups/:groupId/name', { preHandler: app.authenticate }, async (request) =>
  groupService.updateName(
    getAuthenticatedIdentity(request),
    parseGroupId(request),
    parseUpdateGroupNameInput(request.body),
  ),
);

app.get('/groups/dissolved', { preHandler: app.authenticate }, async (request) =>
  groupService.listDissolved(getAuthenticatedIdentity(request)),
);

app.post('/groups/:groupId/restore', { preHandler: app.authenticate }, async (request, reply) => {
  await groupService.restoreGroup(getAuthenticatedIdentity(request), parseGroupId(request));
  return reply.code(204).send();
});
```

解析函数：

```ts
function parseUpdateGroupNameInput(value: unknown): UpdateGroupNameRequest {
  const result = updateGroupNameRequestSchema.safeParse(value);
  if (!result.success) {
    throwValidationError();
  }
  return result.data;
}
```

- [ ] **Step 5: 实现服务**

`apps/api/src/modules/groups/membership-service.ts` 新增：

```ts
public async listCatalog(identity: AuthenticatedIdentity): Promise<GroupCatalogEntry[]> {
  const user = await this.permissionService.getActiveUserForRead(identity);
  const groups = await this.databaseClient.database
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(isNull(groups.deletedAt))
    .orderBy(asc(groups.name), asc(groups.id));
  const memberships = await this.databaseClient.database
    .select({
      groupId: groupMemberships.groupId,
      isUnclaimed: users.cloudbaseUid,
      realName: userProfiles.realName,
      role: groupMemberships.role,
      userId: groupMemberships.userId,
    })
    .from(groupMemberships)
    .innerJoin(users, eq(users.id, groupMemberships.userId))
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(groupMemberships.status, 'active'),
        isNull(groupMemberships.deletedAt),
        isNull(users.deletedAt),
        isNull(userProfiles.deletedAt),
      ),
    );

  return groups.map((group) => {
    const mine = memberships.filter((membership) => membership.groupId === group.id);
    const active = mine.find((membership) => membership.userId === user.id);
    if (active !== undefined) {
      return {
        ...group,
        relation: active.role === 'guest' ? 'active-guest' : 'active-member',
      };
    }
    const left = mine.some(
      (membership) =>
        membership.userId !== user.id &&
        membership.role !== 'guest' &&
        membership.isUnclaimed === null &&
        membership.realName === user.realName,
    );
    return { ...group, relation: left ? 'left-member' : 'none' };
  });
}

public async joinAsGuest(
  identity: AuthenticatedIdentity,
  groupId: string,
): Promise<GroupSummary> {
  return withTransaction(this.databaseClient, async (transaction) => {
    const user = await this.permissionService.getActiveUserInTransaction(transaction, identity);
    const group = await this.permissionService.getActiveGroupForUpdate(transaction, groupId);
    const memberships = await transaction
      .select({
        id: groupMemberships.id,
        realName: userProfiles.realName,
        role: groupMemberships.role,
        status: groupMemberships.status,
        userId: groupMemberships.userId,
      })
      .from(groupMemberships)
      .innerJoin(users, eq(users.id, groupMemberships.userId))
      .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(
        and(
          eq(groupMemberships.groupId, group.id),
          or(eq(groupMemberships.userId, user.id), isNull(groupMemberships.deletedAt)),
        ),
      )
      .for('update');
    const activeMine = memberships.find(
      (membership) => membership.userId === user.id && membership.status === 'active',
    );
    if (activeMine !== undefined) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '您已经加入该群组。',
      });
    }
    const leftMemberPlaceholder = memberships.some(
      (membership) =>
        membership.role !== 'guest' &&
        membership.userId !== user.id &&
        membership.realName === user.realName,
    );
    if (leftMemberPlaceholder) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '该群有您的未认领成员身份，请以成员身份输入群组码重新加入。',
      });
    }
    const existingGuest = memberships.find(
      (membership) => membership.userId === user.id && membership.role === 'guest',
    );
    if (existingGuest !== undefined) {
      await transaction
        .update(groupMemberships)
        .set({
          deletedAt: null,
          status: 'active',
          version: sql`${groupMemberships.version} + 1`,
        })
        .where(eq(groupMemberships.id, existingGuest.id));
    } else {
      await transaction.insert(groupMemberships).values({
        groupId: group.id,
        id: randomUUID(),
        role: 'guest',
        userId: user.id,
      });
    }
    return { id: group.id, name: group.name, role: 'guest', version: group.version };
  });
}

public async leaveGroup(identity: AuthenticatedIdentity, groupId: string): Promise<void> {
  return withTransaction(this.databaseClient, async (transaction) => {
    const user = await this.permissionService.getActiveUserInTransaction(transaction, identity);
    const group = await this.permissionService.getActiveGroupForUpdate(transaction, groupId);
    const membership = await transaction
      .select({ id: groupMemberships.id, role: groupMemberships.role })
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, group.id),
          eq(groupMemberships.userId, user.id),
          eq(groupMemberships.status, 'active'),
          isNull(groupMemberships.deletedAt),
        ),
      )
      .limit(1)
      .for('update');
    if (membership === undefined) {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '您当前没有加入该群组。',
      });
    }
    if (membership.role === 'owner') {
      throw new ApiError({
        code: 'CONFLICT',
        statusCode: 409,
        userMessage: '群主不能退出，请先转让群主或解散群组。',
      });
    }
    if (membership.role === 'guest') {
      await transaction
        .update(groupMemberships)
        .set({
          deletedAt: sql`current_timestamp(3)`,
          status: 'inactive',
          version: sql`${groupMemberships.version} + 1`,
        })
        .where(eq(groupMemberships.id, membership.id));
      return;
    }
    await this.detachMembershipToPlaceholder(transaction, membership.id);
  });
}

private async detachMembershipToPlaceholder(
  transaction: DatabaseTransaction,
  membershipId: string,
): Promise<void> {
  const [membership] = await transaction
    .select({ realName: userProfiles.realName })
    .from(groupMemberships)
    .innerJoin(users, eq(users.id, groupMemberships.userId))
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(groupMemberships.id, membershipId))
    .limit(1);
  if (membership === undefined) {
    return;
  }
  const placeholderUserId = randomUUID();
  await transaction.insert(users).values({ id: placeholderUserId, status: 'active' });
  await transaction.insert(userProfiles).values({
    realName: membership.realName,
    userId: placeholderUserId,
  });
  await transaction
    .update(groupMemberships)
    .set({ userId: placeholderUserId, version: sql`${groupMemberships.version} + 1` })
    .where(eq(groupMemberships.id, membershipId));
  await this.cancelPendingClaimsForTarget(transaction, membershipId);
}
```

`listGroups` 对 guest 剥离 `groupCode`：

```ts
return memberships.map((membership) => ({
  ...membership,
  ...(membership.role === 'guest' ? {} : { groupCode: membership.groupCode }),
  role: membership.role as GroupRole,
}));
```

注意：先查 `role` 再决定是否包含 `groupCode`，`GroupSummary` 类型对 guest 允许省略 `groupCode`（见 Task 2 的契约调整）。

`apps/api/src/modules/groups/group-service.ts` 新增：

```ts
public async updateName(
  identity: AuthenticatedIdentity,
  groupId: string,
  input: UpdateGroupNameRequest,
): Promise<GroupSummary> {
  return withTransaction(this.databaseClient, async (transaction) => {
    const authorization = await this.permissionService.requirePermission(
      transaction,
      identity,
      groupId,
      'updateGroupName',
    );
    await transaction
      .update(groups)
      .set({ name: input.name, version: sql`${groups.version} + 1` })
      .where(eq(groups.id, authorization.group.id));
    return {
      groupCode: authorization.group.groupCode,
      id: authorization.group.id,
      name: input.name,
      role: authorization.membership.role,
      version: authorization.group.version + 1,
    };
  });
}

public async listDissolved(identity: AuthenticatedIdentity): Promise<DissolvedGroup[]> {
  const user = await this.getActiveUser(identity);
  const rows = await this.databaseClient.database
    .select({ deletedAt: groups.deletedAt, id: groups.id, name: groups.name })
    .from(groups)
    .where(
      and(
        eq(groups.ownerUserId, user.id),
        sql`${groups.deletedAt} is not null`,
        sql`${groups.deletedAt} >= timestampadd(day, -30, current_timestamp(3))`,
      ),
    )
    .orderBy(desc(groups.deletedAt), desc(groups.id));
  return rows.map((row) => ({
    deletedAt: row.deletedAt.toISOString(),
    id: row.id,
    name: row.name,
  }));
}

public async restoreGroup(identity: AuthenticatedIdentity, groupId: string): Promise<void> {
  return withTransaction(this.databaseClient, async (transaction) => {
    const user = await this.getActiveUserInTransaction(transaction, identity);
    const [group] = await transaction
      .select({ id: groups.id })
      .from(groups)
      .where(
        and(
          eq(groups.id, groupId),
          eq(groups.ownerUserId, user.id),
          sql`${groups.deletedAt} is not null`,
          sql`${groups.deletedAt} >= timestampadd(day, -30, current_timestamp(3))`,
        ),
      )
      .limit(1)
      .for('update');
    if (group === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '群组不存在、不属于您或已超过恢复期限。',
      });
    }
    await transaction
      .update(groups)
      .set({ deletedAt: null, version: sql`${groups.version} + 1` })
      .where(eq(groups.id, group.id));
  });
}
```

`permission-service.ts` 需新增只读用户查询（供 `listCatalog` 使用）：

```ts
public async getActiveUserForRead(identity: AuthenticatedIdentity): Promise<ActiveGroupUser> {
  const [user] = await this.databaseClient.database
    .select({ id: users.id, realName: userProfiles.realName })
    .from(users)
    .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(users.cloudbaseUid, identity.cloudbaseUid),
        eq(users.status, 'active'),
        isNull(users.deletedAt),
        isNull(userProfiles.deletedAt),
      ),
    )
    .limit(1);
  if (user === undefined) {
    throw new ApiError({
      code: 'NOT_FOUND',
      statusCode: 404,
      userMessage: '当前账号尚未完成个人资料。',
    });
  }
  return user;
}
```

`GroupPermissionService` 需要数据库客户端访问，检查构造函数：当前为 `new GroupPermissionService()` 无参；如无 `databaseClient` 字段，则在构造函数加入 `private readonly databaseClient: DatabaseClient`，并更新所有 `new GroupPermissionService()` 调用点为 `new GroupPermissionService(databaseClient)`（`app.ts`、各模块），逐调用点做语义等价审计（仅注入不变依赖，行为不变）。

- [ ] **Step 6: 更新契约导入与编译**

`group-routes.ts`、`group-service.ts`、`membership-service.ts` 增加所需 import（`UpdateGroupNameRequest`、`GroupCatalogEntry`、`DissolvedGroup`、`updateGroupNameRequestSchema` 等），并 `pnpm --filter @schedule/contracts build`。

- [ ] **Step 7: 运行确认通过**

```bash
pnpm --filter @schedule/api test -- group-routes.integration
pnpm --filter @schedule/api test -- group-permissions.integration
pnpm --filter @schedule/api typecheck
```

- [ ] **Step 8: 提交**

```bash
git add apps/api/src/modules/groups scripts 2>/dev/null; git add apps/api/src/modules/groups
git commit -m "feat(api): guest join/leave, member leave/rejoin, owner rename and dissolve restore"
```

---

### Task 4: 登录访客日历接口与 catalog 权限复核

**Files:**

- Modify: `apps/api/src/modules/calendar/calendar-routes.ts`
- Modify: `apps/api/src/modules/calendar/calendar-query.ts`
- Modify: `apps/api/src/modules/groups/membership-service.ts`（如需）
- Test: `apps/api/src/modules/calendar/calendar.integration.test.ts`

- [ ] **Step 1: 先写失败测试**

```ts
it('serves a guest-shaped calendar to logged-in guest members', async () => {
  const group = await createGroup('Guest calendar group', '7890');
  const groupId = (group.json() as { id: string }).id;
  await app.inject({
    headers: { authorization: 'Bearer outsider-token' },
    method: 'POST',
    url: `/groups/${groupId}/join-guest`,
  });
  const response = await app.inject({
    headers: { authorization: 'Bearer outsider-token' },
    method: 'GET',
    url: `/groups/${groupId}/guest-calendar?businessMonth=2026-08`,
  });
  expect(response.statusCode).toBe(200);
  const body = response.json() as { groupName: string; calendar: { assignments: unknown[] } };
  expect(body.groupName).toBe('Guest calendar group');
  expect(body.calendar.assignments).toEqual([]);
});
```

- [ ] **Step 2: 实现**

`calendar-routes.ts` 追加：

```ts
app.get('/groups/:groupId/guest-calendar', { preHandler: app.authenticate }, async (request) =>
  calendarQuery.readLoggedInGuestMonth(
    getAuthenticatedIdentity(request),
    parseGroupId(request),
    parseBusinessMonth(request.query),
  ),
);
```

`calendar-query.ts` 新增：

```ts
public async readLoggedInGuestMonth(
  identity: AuthenticatedIdentity,
  groupId: string,
  businessMonth: string,
): Promise<GuestCalendarReadModel> {
  return withTransaction(this.databaseClient, async (transaction) => {
    const authorization = await this.permissionService.requirePermission(
      transaction,
      identity,
      groupId,
      'viewGuestCalendar',
    );
    const [group] = await transaction
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(and(eq(groups.id, authorization.group.id), isNull(groups.deletedAt)))
      .limit(1);
    if (group === undefined) {
      throw new ApiError({
        code: 'NOT_FOUND',
        statusCode: 404,
        userMessage: '群组不存在或不可用。',
      });
    }
    return this.readGuestMonthForGroup(group, businessMonth);
  });
}
```

- [ ] **Step 3: 运行确认通过**

```bash
pnpm --filter @schedule/api test -- calendar.integration
```

- [ ] **Step 4: 提交**

```bash
git add apps/api/src/modules/calendar apps/api/src/modules/groups
git commit -m "feat(api): authenticated guest calendar for guest members"
```

---

### Task 5: Web API client 新方法

**Files:**

- Modify: `apps/web/src/api/client.ts`
- Test: `apps/web/src/api/client.test.ts`

- [ ] **Step 1: 先写失败测试**

在 `client.test.ts` 中按现有 mock 模式新增（以下为接口存在性断言，具体 mock 沿用文件内既有 helper）：

```ts
it('exposes group membership self-service methods', async () => {
  const client = createApiClient({ auth: fakeAuth });
  expect(typeof client.listGroupCatalog).toBe('function');
  expect(typeof client.joinGroupAsGuest).toBe('function');
  expect(typeof client.leaveGroup).toBe('function');
  expect(typeof client.updateGroupName).toBe('function');
  expect(typeof client.listDissolvedGroups).toBe('function');
  expect(typeof client.restoreGroup).toBe('function');
});
```

- [ ] **Step 2: 实现接口与实现**

接口：

```ts
listGroupCatalog(): Promise<GroupCatalogEntry[]>;
joinGroupAsGuest(groupId: string): Promise<GroupSummary>;
leaveGroup(groupId: string): Promise<void>;
updateGroupName(groupId: string, input: UpdateGroupNameRequest): Promise<GroupSummary>;
listDissolvedGroups(): Promise<DissolvedGroup[]>;
restoreGroup(groupId: string): Promise<void>;
getGroupGuestCalendar(groupId: string, businessMonth: string): Promise<GuestCalendarReadModel>;
```

实现（沿用 `requestJson`/`requestVoid` 现有模式）：

```ts
listGroupCatalog() {
  return requestJson(
    options.auth,
    fetchImplementation,
    baseUrl,
    '/groups/catalog',
    { method: 'GET' },
    isResponseBodyFromSchema(groupCatalogListSchema),
  );
},
joinGroupAsGuest(groupId) {
  return requestJson(
    options.auth,
    fetchImplementation,
    baseUrl,
    `/groups/${encodeURIComponent(groupId)}/join-guest`,
    { method: 'POST' },
    isResponseBodyFromSchema(groupSummarySchema),
  );
},
leaveGroup(groupId) {
  return requestVoid(
    options.auth,
    fetchImplementation,
    baseUrl,
    `/groups/${encodeURIComponent(groupId)}/leave`,
    { method: 'POST' },
  );
},
updateGroupName(groupId, input) {
  return requestJson(
    options.auth,
    fetchImplementation,
    baseUrl,
    `/groups/${encodeURIComponent(groupId)}/name`,
    { body: JSON.stringify(input), method: 'PUT' },
    isResponseBodyFromSchema(groupSummarySchema),
  );
},
listDissolvedGroups() {
  return requestJson(
    options.auth,
    fetchImplementation,
    baseUrl,
    '/groups/dissolved',
    { method: 'GET' },
    isResponseBodyFromSchema(dissolvedGroupListSchema),
  );
},
restoreGroup(groupId) {
  return requestVoid(
    options.auth,
    fetchImplementation,
    baseUrl,
    `/groups/${encodeURIComponent(groupId)}/restore`,
    { method: 'POST' },
  );
},
getGroupGuestCalendar(groupId, businessMonth) {
  return requestJson(
    options.auth,
    fetchImplementation,
    baseUrl,
    `/groups/${encodeURIComponent(groupId)}/guest-calendar?businessMonth=${encodeURIComponent(businessMonth)}`,
    { method: 'GET' },
    isResponseBodyFromSchema(guestCalendarReadModelSchema),
  );
},
```

若 `requestVoid` 不存在，按现有 `requestJson` 模式返回 204 后丢弃 body；调用点统一。

- [ ] **Step 3: 运行确认通过**

```bash
pnpm --filter @schedule/web test -- client.test
pnpm --filter @schedule/web typecheck
```

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/api/client.ts apps/web/src/api/client.test.ts
git commit -m "feat(web): group membership self-service API client"
```

---

### Task 6: 导航角色过滤与登录访客工作台

**Files:**

- Modify: `apps/web/src/features/layout/workbench-nav.ts`
- Modify: `apps/web/src/features/layout/workbench-nav.spec.ts`
- Modify: `apps/web/src/features/groups/GroupSwitcher.vue`
- Modify: `apps/web/src/views/HomeView.vue`
- Create: `apps/web/src/features/groups/GuestCalendarPanel.vue`

- [ ] **Step 1: 先写失败测试**

`workbench-nav.spec.ts` 新增：

```ts
it('hides events from members and shows it to administrators', () => {
  const memberIds = getVisibleNavItems('member').map((item) => item.id);
  const adminIds = getVisibleNavItems('administrator').map((item) => item.id);
  expect(memberIds).not.toContain('events');
  expect(adminIds).toContain('events');
});

it('limits guests to calendar and group management', () => {
  expect(getVisibleNavItems('guest').map((item) => item.id)).toEqual(['calendar', 'groups']);
});
```

- [ ] **Step 2: 实现**

`workbench-nav.ts`：

```ts
export function getVisibleNavItems(role: GroupRole): readonly WorkbenchNavItem[] {
  const base = workbenchNavItems.filter((item) => !item.requiresAdministrator || role !== 'member');
  if (role === 'guest') {
    return base.filter((item) => item.id === 'calendar' || item.id === 'groups');
  }
  return base;
}
```

`workbenchNavItems` 中 `events` 改为 `requiresAdministrator: true`。

`GroupSwitcher.vue` 标签：

```ts
function roleLabel(role: GroupSummary['role']): string {
  if (role === 'owner') return '群主';
  if (role === 'administrator') return '管理员';
  return role === 'guest' ? '访客' : '成员';
}
```

新建 `apps/web/src/features/groups/GuestCalendarPanel.vue`（简化月历，复用 `MonthGrid` 与公开访客数据形态）：

```vue
<script setup lang="ts">
import type {
  ConfirmedHolidayDate,
  GroupSummary,
  GuestCalendarReadModel,
} from '@schedule/contracts';
import { computed, ref, watch } from 'vue';
import { createApiClient } from '../../api/client.js';
import { localAuth } from '../../auth/local-auth.js';
import {
  addBusinessMonths,
  getBusinessMonthLabel,
  getCurrentBusinessMonth,
} from '../calendar/calendar-logic.js';
import { getBusinessDate } from '../calendar/calendar-views.js';
import MonthGrid from '../calendar/MonthGrid.vue';

const props = defineProps<{ readonly group: GroupSummary }>();
const api = createApiClient({ auth: localAuth });
const businessMonth = ref(getCurrentBusinessMonth());
const calendar = ref<GuestCalendarReadModel>();
const holidays = ref<ReadonlyMap<string, ConfirmedHolidayDate>>(new Map());

watch(
  () => [props.group.id, businessMonth.value],
  () => void loadCalendar(),
  { immediate: true },
);

async function loadCalendar(): Promise<void> {
  calendar.value = await api.getGroupGuestCalendar(props.group.id, businessMonth.value);
  const year = Number(businessMonth.value.slice(0, 4));
  const nextHolidays = await api.getGuestHolidays(year);
  holidays.value = new Map(nextHolidays.dates.map((date) => [date.date, date] as const));
}
</script>

<template>
  <section class="guest-calendar-panel">
    <h2>排班日历（访客）</h2>
    <div class="guest-calendar-toolbar">
      <t-button variant="outline" @click="businessMonth = addBusinessMonths(businessMonth, -1)">
        上一月
      </t-button>
      <strong>{{ getBusinessMonthLabel(businessMonth) }}</strong>
      <t-button variant="outline" @click="businessMonth = addBusinessMonths(businessMonth, 1)">
        下一月
      </t-button>
    </div>
    <MonthGrid
      v-if="calendar !== undefined"
      :assignments="calendar.calendar.assignments"
      :business-month="calendar.calendar.businessMonth"
      :holidays="holidays"
      :members="calendar.calendar.members"
      :today="getBusinessDate()"
    />
  </section>
</template>
```

`HomeView.vue`：

- 导入并渲染 `GuestCalendarPanel`：

```vue
<GuestCalendarPanel
  v-if="activeTab === 'calendar' && currentGroup()?.role === 'guest'"
  :group="currentGroup()!"
/>
<CalendarView v-else-if="activeTab === 'calendar'" :group="currentGroup()!" />
```

- 导出按钮条件改为群主/管理员：

```vue
<div v-if="currentGroup()?.role === 'owner' || currentGroup()?.role === 'administrator'" class="workbench-actions">
```

- 向 `GroupSetupPanel` 传当前群组：

```vue
<GroupSetupPanel
  v-if="activeTab === 'groups'"
  :group="currentGroup()"
  @groups-changed="refreshGroups"
/>
```

- [ ] **Step 3: 运行确认通过**

```bash
pnpm --filter @schedule/web test -- workbench-nav.spec
pnpm --filter @schedule/web typecheck
pnpm --filter @schedule/web build
```

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/features/layout apps/web/src/features/groups apps/web/src/views/HomeView.vue
git commit -m "feat(web): hide events nav from members and add logged-in guest workbench"
```

---

### Task 7: 群组管理面板重构

**Files:**

- Modify: `apps/web/src/features/groups/GroupSetupPanel.vue`

- [ ] **Step 1: 增加 props 与状态**

```ts
const props = defineProps<{
  readonly group?: GroupSummary;
}>();

const joinGroupId = ref('');
const joinMode = ref<'guest' | 'member'>('guest');
const catalog = ref<GroupCatalogEntry[]>([]);
const dissolvedGroups = ref<DissolvedGroup[]>([]);
const leaveVisible = ref(false);
```

- [ ] **Step 2: 加载 catalog 与已解散列表**

```ts
async function loadCatalog(): Promise<void> {
  catalog.value = await api.listGroupCatalog();
}

async function loadDissolved(): Promise<void> {
  if (props.group?.role !== 'owner') {
    dissolvedGroups.value = [];
    return;
  }
  dissolvedGroups.value = await api.listDissolvedGroups();
}
```

`onMounted(() => { void loadCatalog(); void loadDissolved(); })`；`watch(() => props.group?.id, () => void loadDissolved())`。

- [ ] **Step 3: 加入与退出**

```ts
async function joinSelectedGroup(): Promise<void> {
  if (joinGroupId.value === '') return;
  if (joinMode.value === 'guest') {
    joinedGroup.value = await api.joinGroupAsGuest(joinGroupId.value);
  } else {
    const result = await api.claimGroup({
      groupCode: claimCode.value.trim(),
      realName: claimRealName.value.trim(),
    });
    if (result.status === 'claimed') joinedGroup.value = result.group;
  }
  emit('groups-changed', joinedGroup.value.id);
  await loadCatalog();
}

async function leaveCurrentGroup(): Promise<void> {
  if (props.group === undefined) return;
  leaveVisible.value = true;
  try {
    await api.leaveGroup(props.group.id);
    emit('groups-changed');
  } finally {
    leaveVisible.value = false;
  }
}

async function dissolveCurrentGroup(): Promise<void> {
  if (props.group === undefined) return;
  await api.deleteGroup(props.group.id);
  emit('groups-changed');
  await loadDissolved();
}

async function restoreGroup(groupId: string): Promise<void> {
  await api.restoreGroup(groupId);
  emit('groups-changed');
  await loadDissolved();
}

async function saveGroupName(): Promise<void> {
  if (props.group === undefined) return;
  await api.updateGroupName(props.group.id, { name: groupName.value });
  emit('groups-changed');
}
```

模板新增卡片（简化示意，按 TDesign 现有写法落地）：

- “加入其他群组”：`t-select`（catalog）+ `t-radio-group`（访客/成员）+ 成员时显示群组码输入框 + 提交按钮；`relation === 'left-member'` 时访客单选禁用；`relation` 为 active 时显示“已加入”。
- “当前群组操作”：退出按钮（非群主）；群主显示名称输入、保存、修改群组码（沿用 `regenerateCode`）、解散按钮。
- “已解散群组”（仅群主）：`dissolvedGroups` 列表 + 每个“恢复”按钮。

- [ ] **Step 4: 运行确认通过**

```bash
pnpm --filter @schedule/web typecheck
pnpm --filter @schedule/web build
```

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/features/groups/GroupSetupPanel.vue
git commit -m "feat(web): rebuild group management with join dropdown, leave, rename, dissolve and restore"
```

---

### Task 8: 浏览器冒烟扩展与收尾

**Files:**

- Modify: `scripts/smoke-browser.mjs`
- Modify: `docs/project-status.md`
- Modify: `docs/debug/debug-feedback-log.md`（如需登记状态三态）

- [ ] **Step 1: 在冒烟脚本新增断言**

在现有管理员/成员/访客流程后追加（使用既有 helper `waitForBodyText`/`click` 模式）：

1. 登录管理员：进入“群组管理”，选“访客身份”加入示例群 → 群组切换器出现“访客”标签；打开后断言出现“排班日历（访客）”且页面无“事件”导航。
2. 访客退出 → 群组列表不再出现该群；再次访客加入恢复。
3. 管理员成员页：把某成员退出后断言该行显示“未认领”（需要先通过 API 或 UI 完成成员退出；UI 上由该成员账号执行，冒烟脚本用第二个登录上下文完成）。
4. 群主改名/改码/解散/恢复：断言名称变化、群组码变化、解散后下拉消失、恢复后重新出现。
5. 普通成员导航无“事件”，管理员导航有“事件”。

- [ ] **Step 2: 运行验证**

```bash
pnpm verify
pnpm smoke:browser
pnpm smoke:check-core
```

预期：全部通过；`smoke:check-core` 因 contracts/api/web 核心链路改动要求本轮记录浏览器冒烟，冒烟记录写入 `docs/debug/debug-feedback-log.md` 或 `fix-progress.md`。

- [ ] **Step 3: 更新状态文档**

`docs/project-status.md` 更新：完成项、验证命令与结果、下一批任务、状态三态（浏览器验证后为“已完成”，同步服务器后为“待用户强刷复核”）。

- [ ] **Step 4: 提交并推送**

```bash
git add scripts/smoke-browser.mjs docs/project-status.md docs/debug/debug-feedback-log.md
git commit -m "test(web): extend browser smoke for group membership and event nav visibility"
git push origin main
```

---

## 自检记录

- 规格覆盖：设计文档第 4–8 节全部落到任务 1–7；第 10–11 节落到任务 1–8。
- 无占位符：所有任务都有明确文件路径、步骤、命令与代码块。
- 类型一致性：`guest` 角色贯穿迁移/契约/权限/前端；`GroupCatalogEntry`、`DissolvedGroup`、`UpdateGroupNameRequest` 命名在 Task 2–7 一致。
- 已知风险：`GroupPermissionService` 若需要注入 `DatabaseClient` 会牵连多个构造点，任务 3 已要求逐调用点语义等价审计。
