import { z } from 'zod';

const uuid = z.string().uuid();
const configSchema = z
  .object({
    groupId: uuid,
    firstDutyMembershipIds: z.array(uuid).min(1).max(7),
    firstDutyRoleId: uuid,
    secondDutyByFirstMembershipId: z.record(uuid, uuid),
    thirdDutyMembershipIds: z.tuple([uuid, uuid]),
  })
  .strict();

export type HeadNeckDocxConfig = z.infer<typeof configSchema>;

export function readHeadNeckDocxConfig(): HeadNeckDocxConfig | undefined {
  const raw = process.env['HEAD_NECK_DOCX_EXPORT_CONFIG'];
  if (raw === undefined || raw.trim().length === 0) return undefined;
  try {
    const config = configSchema.parse(JSON.parse(raw));
    const first = new Set(config.firstDutyMembershipIds);
    if (first.size !== config.firstDutyMembershipIds.length) return undefined;
    if (
      config.firstDutyMembershipIds.some(
        (id) => config.secondDutyByFirstMembershipId[id] === undefined,
      )
    )
      return undefined;
    return config;
  } catch {
    return undefined;
  }
}

export function getHeadNeckDocxConfig(groupId: string): HeadNeckDocxConfig | undefined {
  const config = readHeadNeckDocxConfig();
  return config?.groupId === groupId ? config : undefined;
}
