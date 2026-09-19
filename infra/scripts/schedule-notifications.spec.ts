import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const scriptPath = fileURLToPath(new URL('./schedule-notifications.sh', import.meta.url));

describe('production recurring jobs', () => {
  it('runs pending export jobs from the every-minute worker', async () => {
    const script = await readFile(scriptPath, 'utf8');

    expect(script).toContain('run_job export-jobs');
  });

  it('runs every-minute jobs inside the warm api container instead of a one-off container', async () => {
    const script = await readFile(scriptPath, 'utf8');

    // 2 vCPU/1.6GB 机器上每分钟三个一次性容器会持续读镜像层、挤出页缓存，
    // 生产实测把 API 请求拖到 5-12 秒。常驻容器内执行是这条链路的默认路径。
    expect(script).toContain('API_CONTAINER=medical-schedule-prod-api-1');
    expect(script).toContain(
      'docker exec "$API_CONTAINER" node apps/api/dist/jobs/run-job.js "--job=$1"',
    );
    expect(script).toContain(`docker inspect --format '{{.State.Running}}' "$API_CONTAINER"`);
    for (const job of ['export-jobs', 'duty-reminders', 'notification-retry']) {
      expect(script).toContain(`run_job ${job}`);
    }
    // 一次性容器只作为常驻容器不可用时的回退，不能重新变成每分钟的默认路径。
    const execIndex = script.indexOf('docker exec "$API_CONTAINER"');
    const oneOffIndex = script.indexOf('run --rm api');
    expect(execIndex).toBeGreaterThan(-1);
    expect(oneOffIndex).toBeGreaterThan(execIndex);
    expect(script).not.toContain('compose_run');
  });
});
