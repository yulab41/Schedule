import type { GroupRole } from '@schedule/contracts';

export function splitGroupCode(groupCode: string | undefined): readonly string[] {
  return groupCode === undefined ? [] : [...groupCode];
}

export function getGroupRoleLabel(role: GroupRole): string {
  switch (role) {
    case 'owner':
      return '群主';
    case 'administrator':
      return '管理员';
    case 'guest':
      return '访客';
    case 'member':
      return '成员';
  }
}
