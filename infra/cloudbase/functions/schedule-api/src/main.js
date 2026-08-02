import { createCloudbaseHandler } from '../../../../../apps/api/src/cloudbase-handler.js';

const handler = createCloudbaseHandler();

export async function main(event) {
  return handler(event);
}
