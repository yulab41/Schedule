import { createHash } from 'node:crypto';
import {
  externalDutyActions,
  externalDutyChecks,
  groups,
  withTransaction,
  type DatabaseClient,
} from '@schedule/database';
import { and, eq, gte } from 'drizzle-orm';
import type { AuthenticatedIdentity } from '../../adapters/auth/auth-port.js';
import { ApiError } from '../../plugins/error-handler.js';
import { DutyAdjustmentService } from '../duty-adjustments/duty-adjustment-service.js';
import { SwapService } from '../swaps/swap-service.js';
import type { ExternalDutySnapshot } from './external-duty-source.js';
import { suggestExternalDuty } from './suggest-external-duty.js';
import { DUTY_EXECUTION_BUDGET_MS } from './processing-duty-lease.js';

export type DutyDirection = 'to_external' | 'to_local';
export interface ResolveDutyInput {
  readonly date: string;
  readonly expectedFingerprint: string;
  readonly direction: DutyDirection;
}
interface LocalDuty {
  readonly id: string;
  readonly version: number;
  readonly periodId: string;
  readonly name: string | null;
  readonly membershipId: string | null;
  readonly baselineName: string | null;
}
interface ResolvePorts {
  readonly authorize: (identity: AuthenticatedIdentity) => Promise<string>;
  readonly readLocal: (group: string, date: string) => Promise<readonly LocalDuty[]>;
  readonly readRemote: () => Promise<ExternalDutySnapshot>;
  readonly member: (group: string, date: string, name: string) => Promise<string>;
  readonly push: (
    identity: AuthenticatedIdentity,
    date: string,
    fingerprint: string,
  ) => Promise<unknown>;
  readonly scan: () => Promise<unknown>;
}

export class ExternalDutyResolver {
  public constructor(
    private readonly client: DatabaseClient,
    private readonly ports: ResolvePorts,
  ) {}

  private async prepare(identity: AuthenticatedIdentity, input: ResolveDutyInput) {
    const actor = await this.ports.authorize(identity);
    if (input.date < today() || input.date > '2027-06-30') throw stale('日期已不在校对范围');
    const [selected] = await this.client.database
      .select()
      .from(externalDutyChecks)
      .where(eq(externalDutyChecks.businessDate, input.date))
      .limit(1);
    if (
      !selected ||
      selected.fingerprint !== input.expectedFingerprint ||
      !selected.schedulePeriodId
    )
      throw stale('排班已变化，请重新检测');
    const rows = await this.client.database
      .select()
      .from(externalDutyChecks)
      .where(
        and(
          eq(externalDutyChecks.schedulePeriodId, selected.schedulePeriodId),
          eq(externalDutyChecks.groupId, selected.groupId),
          eq(externalDutyChecks.isInScope, 1),
          gte(externalDutyChecks.businessDate, today()),
        ),
      )
      .orderBy(externalDutyChecks.businessDate);
    const remote = await this.ports.readRemote();
    const live = await Promise.all(
      rows.map(async (row) => ({
        row,
        local: await this.ports.readLocal(row.groupId, row.businessDate),
      })),
    );
    // Derive connected dates from live values too: a new link outside the original
    // component must not silently disappear just because the scanner has not run.
    const suggestion = suggestExternalDuty(
      live.map(({ row, local }) => ({
        ...row,
        localName: local.length === 1 ? local[0]!.name : null,
        remoteName: remote.duties.get(row.businessDate) ?? row.remoteName,
      })),
      'manual',
    ).get(input.date);
    const dates =
      input.direction === 'to_external'
        ? [input.date]
        : suggestion && suggestion.kind !== 'blocked'
          ? suggestion.dates
          : null;
    if (!dates) throw stale('关联日期正在处理或班次不完整，请重新校对');
    const items = [];
    for (const date of dates) {
      const entry = live.find((item) => item.row.businessDate === date);
      const row = entry?.row;
      const local = entry?.local.length === 1 ? entry.local[0] : undefined;
      if (
        !row ||
        !local ||
        row.status !== 'pending' ||
        row.blockReason ||
        row.businessDate < today() ||
        !row.baselineName ||
        !local.membershipId ||
        !row.assignmentId ||
        row.assignmentId !== local.id ||
        row.assignmentVersion !== local.version ||
        row.schedulePeriodId !== local.periodId ||
        row.baselineName !== local.baselineName ||
        row.localName !== local.name ||
        row.remoteName !== remote.duties.get(date) ||
        row.localName === row.remoteName
      )
        throw stale('排班已变化，请重新检测后预览');
      if (input.direction === 'to_external' && !remote.people.includes(local.name!))
        throw stale('本系统值班人无法对应网页人员');
      const targetMember =
        input.direction === 'to_local'
          ? await this.ports.member(row.groupId, date, row.remoteName)
          : await this.ports.member(row.groupId, date, local.name!);
      if (input.direction === 'to_external' && targetMember !== local.membershipId)
        throw stale('本系统值班人无法唯一对应当前成员');
      items.push({ row, local: { ...local }, targetMember });
    }
    const kind =
      input.direction === 'to_external'
        ? ('external' as const)
        : suggestion!.kind === 'swap'
          ? ('swap' as const)
          : ('duty' as const);
    const swaps = suggestion?.kind === 'swap' && kind === 'swap' ? suggestion.steps : [];
    const planFingerprint = digest([
      input.direction,
      actor,
      kind,
      items.map(({ row, local, targetMember }) => [
        row.businessDate,
        row.fingerprint,
        row.baselineName,
        row.remoteName,
        local.id,
        local.periodId,
        local.version,
        local.name,
        local.membershipId,
        targetMember,
      ]),
      swaps,
    ]);
    return { actor, items, kind, swaps, planFingerprint };
  }

  public async preview(identity: AuthenticatedIdentity, input: ResolveDutyInput) {
    const plan = await this.prepare(identity, input);
    const conflicts: { message: string }[] = [];
    if (plan.kind === 'swap') {
      const first = plan.swaps[0]!;
      const a = plan.items.find((item) => item.row.businessDate === first.date)!;
      const b = plan.items.find((item) => item.row.businessDate === first.targetDate)!;
      const preview = await new SwapService(this.client).preview(identity, a.row.groupId, {
        initiatorAssignmentId: a.local.id,
        initiatorMembershipId: a.local.membershipId!,
        targetAssignmentId: b.local.id,
        targetMembershipId: b.local.membershipId!,
      });
      conflicts.push(...preview.conflicts);
    } else if (plan.kind === 'duty') {
      for (const item of plan.items) {
        const preview = await new DutyAdjustmentService(this.client).preview(
          identity,
          item.row.groupId,
          {
            coveredAssignmentId: item.local.id,
            overtimeMembershipId: item.targetMember,
          },
        );
        conflicts.push(...preview.conflicts);
      }
    }
    return {
      kind: plan.kind,
      planFingerprint: plan.planFingerprint,
      conflicts,
      changes: plan.items.map(({ row }) => ({
        date: row.businessDate,
        before: (plan.kind === 'external' ? row.remoteName : row.localName)!,
        after: (plan.kind === 'external' ? row.localName : row.remoteName)!,
      })),
      steps:
        plan.kind === 'swap'
          ? plan.swaps.map((step) => `${step.date} 与 ${step.targetDate} 交换`)
          : plan.kind === 'duty'
            ? plan.items.map(({ row }) => `${row.businessDate} 加扣班`)
            : [],
    };
  }

  public async apply(
    identity: AuthenticatedIdentity,
    input: ResolveDutyInput & { readonly planFingerprint: string },
  ) {
    const plan = await this.prepare(identity, input);
    if (plan.planFingerprint !== input.planFingerprint) throw stale('同步方案已变化，请重新预览');
    if (plan.kind === 'external')
      return this.ports.push(identity, input.date, input.expectedFingerprint);
    // Claim every related date atomically. Requests from different cards then
    // compete for the same dates instead of executing overlapping plans.
    const claimedAt = new Date();
    await withTransaction(this.client, async (tx) => {
      await tx
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.id, plan.items[0]!.row.groupId))
        .for('update');
      for (const { row } of plan.items) {
        const [claimed] = await tx
          .update(externalDutyChecks)
          .set({ status: 'processing', observedAt: claimedAt })
          .where(
            and(
              eq(externalDutyChecks.businessDate, row.businessDate),
              eq(externalDutyChecks.fingerprint, row.fingerprint),
              eq(externalDutyChecks.status, 'pending'),
            ),
          );
        if (claimed.affectedRows !== 1) throw stale('关联日期正在处理，请刷新后重新确认');
      }
    });
    let completedSteps = 0;
    let failure: unknown;
    try {
      const operations =
        plan.kind === 'swap'
          ? plan.swaps.map((step) => ({
              a: plan.items.find((item) => item.row.businessDate === step.date)!,
              b: plan.items.find((item) => item.row.businessDate === step.targetDate),
            }))
          : plan.items.map((a) => ({ a, b: undefined }));
      for (const [index, { a, b }] of operations.entries()) {
        const remote = await this.ports.readRemote();
        for (const item of plan.items) {
          const current = await this.ports.readLocal(item.row.groupId, item.row.businessDate);
          if (
            current.length !== 1 ||
            current[0]!.id !== item.local.id ||
            current[0]!.periodId !== item.local.periodId ||
            current[0]!.version !== item.local.version ||
            current[0]!.name !== item.local.name ||
            current[0]!.membershipId !== item.local.membershipId ||
            remote.duties.get(item.row.businessDate) !== item.row.remoteName ||
            (await this.ports.member(
              item.row.groupId,
              item.row.businessDate,
              item.row.remoteName,
            )) !== item.targetMember
          )
            throw stale('方案执行期间排班或人员已变化，请重新校对');
        }
        const operationId = operationUuid([plan.planFingerprint, index]);
        const before = a.local.name;
        const after = b ? b.local.name : a.row.remoteName;
        const expected = [a, ...(b ? [b] : [])].map((item) => ({
          id: item.local.id,
          version: item.local.version,
        }));
        let workflow;
        if (b) {
          const swap = new SwapService(this.client);
          const preview = await swap.preview(identity, a.row.groupId, {
            initiatorAssignmentId: a.local.id,
            initiatorMembershipId: a.local.membershipId!,
            targetAssignmentId: b.local.id,
            targetMembershipId: b.local.membershipId!,
          });
          if (preview.conflicts.length) throw stale(preview.conflicts[0]!.message);
          assertBudget(claimedAt);
          workflow = await swap.createDirect(
            identity,
            a.row.groupId,
            {
              initiatorAssignmentId: a.local.id,
              targetAssignmentId: b.local.id,
              operationId,
            },
            expected,
          );
        } else {
          const duty = new DutyAdjustmentService(this.client);
          const preview = await duty.preview(identity, a.row.groupId, {
            coveredAssignmentId: a.local.id,
            overtimeMembershipId: a.targetMember,
          });
          if (preview.conflicts.length) throw stale(preview.conflicts[0]!.message);
          assertBudget(claimedAt);
          workflow = await duty.createDirect(
            identity,
            a.row.groupId,
            {
              coveredAssignmentId: a.local.id,
              overtimeMembershipId: a.targetMember,
              reason: '排班网页校对：管理员选择以网页为准',
              operationId,
            },
            expected,
          );
        }
        completedSteps++;
        await this.client.database.insert(externalDutyActions).values({
          id: operationId,
          businessDate: a.row.businessDate,
          groupId: a.row.groupId,
          schedulePeriodId: a.local.periodId,
          assignmentId: a.local.id,
          side: 'local',
          baselineName: a.row.baselineName!,
          beforeName: before,
          afterName: after,
          workflowKind: b ? 'swap' : 'duty',
          workflowId: workflow.id,
          actorUserId: plan.actor,
        });
        if (workflow.status !== 'completed')
          throw stale('申请已提交，等待原流程完成后再执行剩余步骤');
        if (b) {
          [a.local.name, b.local.name] = [b.local.name, a.local.name];
          [a.local.membershipId, b.local.membershipId] = [
            b.local.membershipId,
            a.local.membershipId,
          ];
          b.local.version++;
        } else {
          a.local.name = a.row.remoteName;
          a.local.membershipId = a.targetMember;
        }
        a.local.version++;
      }
      // Do not report success until the final step has also been read back.
      const remoteAfter = await this.ports.readRemote();
      for (const item of plan.items) {
        const current = await this.ports.readLocal(item.row.groupId, item.row.businessDate);
        if (
          current.length !== 1 ||
          current[0]!.id !== item.local.id ||
          current[0]!.periodId !== item.local.periodId ||
          current[0]!.membershipId !== item.local.membershipId ||
          current[0]!.name !== item.row.remoteName ||
          current[0]!.version !== item.local.version ||
          remoteAfter.duties.get(item.row.businessDate) !== item.row.remoteName
        )
          throw stale('执行后排班已变化，请重新校对');
      }
    } catch (error) {
      failure = completedSteps
        ? stale(`已提交 ${completedSteps} 步，后续未完成。请查看操作记录并重新检测。`)
        : error;
    }
    try {
      for (const { row } of plan.items) {
        await this.client.database
          .update(externalDutyChecks)
          .set({ status: 'pending' })
          .where(
            and(
              eq(externalDutyChecks.businessDate, row.businessDate),
              eq(externalDutyChecks.observedAt, claimedAt),
              eq(externalDutyChecks.status, 'processing'),
            ),
          );
      }
      await this.ports.scan();
    } catch {
      if (!failure)
        failure = stale(
          `已提交 ${completedSteps} 步，校对状态刷新未完成。请查看操作记录并重新检测。`,
        );
    }
    if (failure) throw failure;
    return { completedSteps, verified: true };
  }
}

function assertBudget(claimedAt: Date) {
  if (Date.now() - claimedAt.valueOf() >= DUTY_EXECUTION_BUDGET_MS)
    throw stale('执行时间过长，请重新检测后预览剩余日期');
}

function today() {
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
}
function digest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function operationUuid(value: unknown) {
  const hash = digest(value);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
function stale(userMessage: string) {
  return new ApiError({ code: 'CONFLICT', statusCode: 409, userMessage });
}
