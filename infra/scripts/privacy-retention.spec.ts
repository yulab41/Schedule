import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

async function read(relativePath: string): Promise<string> {
  return readFile(fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)), 'utf8');
}

describe('production privacy retention controls', () => {
  it('runs the privacy job under a host lock every fifteen minutes', async () => {
    const [scheduler, update, verify] = await Promise.all([
      read('infra/scripts/schedule-privacy-retention.sh'),
      read('infra/scripts/ecs-update.sh'),
      read('infra/scripts/ecs-verify.sh'),
    ]);

    expect(scheduler).toContain('/var/lock/schedule-privacy-retention.lock');
    expect(scheduler).toContain('--job=privacy-retention');
    expect(update).toContain(
      '*/15 * * * * root /usr/local/lib/schedule/schedule-privacy-retention.sh',
    );
    expect(verify).toContain('/etc/cron.d/schedule-privacy-retention');
    expect(verify).toContain('privacyRetentionSchedulerSha256');
  });

  it('uses one trusted proxy hop and privacy-safe Nginx request logging', async () => {
    const [app, nginx] = await Promise.all([
      read('apps/api/src/app.ts'),
      read('infra/docker/nginx.prod.conf'),
    ]);

    expect(app).toContain('trustProxy: 1');
    expect(nginx).toContain('log_format schedule_privacy');
    expect(nginx.match(/access_log \/dev\/stdout schedule_privacy;/gu)).toHaveLength(4);
    expect(nginx).toContain('proxy_set_header X-Forwarded-For $remote_addr;');
    expect(nginx).not.toContain('$proxy_add_x_forwarded_for');
    const logFormat = /log_format schedule_privacy([\s\S]*?);/u.exec(nginx)?.[1] ?? '';
    expect(logFormat).not.toMatch(/\$remote_addr|\$request\b|\$args|\$query_string/u);
  });

  it('pins binlog expiry and disables the MySQL general log', async () => {
    const [compose, verify] = await Promise.all([
      read('infra/docker/compose.prod.yml'),
      read('infra/scripts/ecs-verify.sh'),
    ]);

    expect(compose).toContain('--binlog-expire-logs-seconds=2592000');
    expect(compose).toContain('--general-log=OFF');
    expect(verify).toContain('@@global.binlog_expire_logs_seconds');
    expect(verify).toContain('@@global.general_log');
  });

  it('rate-limits the exact telemetry route and caps its body before proxying', async () => {
    const nginx = await read('infra/docker/nginx.prod.conf');

    expect(nginx).toContain('limit_req_zone $binary_remote_addr zone=schedule_telemetry:1m');
    expect(nginx).toContain('location = /api/client-telemetry');
    expect(nginx).toContain('client_max_body_size 16k');
    expect(nginx).toContain('limit_req zone=schedule_telemetry');
  });
});
