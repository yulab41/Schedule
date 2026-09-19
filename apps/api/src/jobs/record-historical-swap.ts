import { createDatabaseClient } from '@schedule/database';

import { loadEnvironment } from '../config/env.js';
import { SwapService } from '../modules/swaps/swap-service.js';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (value === undefined || value === '') throw new Error(`${name} is required.`);
  return value;
};

if (required('SCHEDULE_CONFIRM_HISTORICAL_SWAP') !== 'record-completed-without-notification') {
  throw new Error('Historical swap confirmation does not match.');
}

const environment = loadEnvironment();
const client = createDatabaseClient({
  database: environment.MYSQL_DATABASE,
  host: environment.MYSQL_HOST,
  password: environment.MYSQL_PASSWORD,
  port: environment.MYSQL_PORT,
  user: environment.MYSQL_USER,
});

try {
  const result = await new SwapService(client).recordHistoricalCompleted({
    groupId: required('SCHEDULE_HISTORICAL_SWAP_GROUP_ID'),
    initiatorAssignmentId: required('SCHEDULE_HISTORICAL_SWAP_INITIATOR_ASSIGNMENT_ID'),
    initiatorMembershipId: required('SCHEDULE_HISTORICAL_SWAP_INITIATOR_MEMBERSHIP_ID'),
    targetAssignmentId: required('SCHEDULE_HISTORICAL_SWAP_TARGET_ASSIGNMENT_ID'),
    targetMembershipId: required('SCHEDULE_HISTORICAL_SWAP_TARGET_MEMBERSHIP_ID'),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await client.close();
}
