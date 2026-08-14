export interface SchedulingConfigurationOverviewSource {
  readonly groupMembers: readonly { readonly membershipId: string }[];
  readonly roles: readonly {
    readonly members: readonly { readonly membershipId: string }[];
  }[];
  readonly shiftTypes: readonly { readonly isEnabled: boolean }[];
}

export interface SchedulingConfigurationOverviewStep {
  readonly isComplete: boolean;
  readonly key: 'members' | 'roles' | 'shifts';
  readonly label: string;
  readonly value: string;
}

export interface SchedulingConfigurationOverview {
  readonly status: 'established' | 'incomplete';
  readonly statusLabel: string;
  readonly steps: readonly SchedulingConfigurationOverviewStep[];
}

export function getSchedulingConfigurationOverview(
  config: SchedulingConfigurationOverviewSource,
): SchedulingConfigurationOverview {
  const roleCount = config.roles.length;
  const enabledShiftCount = config.shiftTypes.filter((shiftType) => shiftType.isEnabled).length;
  const assignedMembershipIds = new Set(
    config.roles.flatMap((role) => role.members.map((member) => member.membershipId)),
  );
  const assignedMemberCount = assignedMembershipIds.size;
  const steps: readonly SchedulingConfigurationOverviewStep[] = [
    {
      isComplete: roleCount > 0,
      key: 'roles',
      label: '排班岗位',
      value: `${roleCount} 项`,
    },
    {
      isComplete: enabledShiftCount > 0,
      key: 'shifts',
      label: '启用班种',
      value: `${enabledShiftCount} 项`,
    },
    {
      isComplete: assignedMemberCount > 0,
      key: 'members',
      label: '已配置成员',
      value: `${assignedMemberCount} / ${config.groupMembers.length} 位`,
    },
  ];
  const status = steps.every((step) => step.isComplete) ? 'established' : 'incomplete';

  return {
    status,
    statusLabel: status === 'established' ? '基础配置已建立' : '还有基础配置待完善',
    steps,
  };
}
