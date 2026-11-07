import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('shared gateway release boundary', () => {
  it('keeps the existing pregnancy proxy inside the AI virtual host', async () => {
    const nginx = await readFile('infra/docker/nginx.prod.conf', 'utf8');
    const servers = nginx.split('\nserver {');
    const aiHost =
      servers.find(
        (server) =>
          server.includes('server_name aitool.eylinhome.top;') &&
          server.includes('listen 443 ssl;'),
      ) ?? '';
    const location = /location \^~ \/pregnancy\/ \{([^}]+)\}/u.exec(aiHost)?.[1];
    expect(location).toBeDefined();
    expect(location).toContain('proxy_pass http://host.docker.internal:18771/;');
    expect(location).toContain('proxy_set_header Authorization $http_authorization;');
    expect(location).toContain('client_max_body_size 70m;');
    expect(location).toContain('proxy_request_buffering off;');
    expect(location).toContain('proxy_read_timeout 300s;');
    const scheduleHost =
      servers.find((server) => server.includes('server_name hosp.schedule.eylinhome.top;')) ?? '';
    expect(scheduleHost).not.toContain('location ^~ /pregnancy/');
  });

  it('preserves the already active AI site when the next Schedule release replaces the gateway', async () => {
    const nginx = await readFile('infra/docker/nginx.prod.conf', 'utf8');
    const hasRegisteredSite =
      nginx.includes('include /etc/letsencrypt/aitool/ingress.conf;') ||
      nginx.includes('server_name aitool.eylinhome.top;');
    expect(hasRegisteredSite).toBe(true);
    expect(nginx).toContain('ssl_reject_handshake on;');
    expect(nginx).toContain('server_name hosp.schedule.eylinhome.top;');
  });

  it('ships the AI virtual host with independent connection limits and a stable host gateway', async () => {
    const nginx = await readFile('infra/docker/nginx.prod.conf', 'utf8');
    const compose = await readFile('infra/docker/compose.prod.yml', 'utf8');
    expect(nginx).toContain('server_name aitool.eylinhome.top;');
    expect(nginx).not.toContain('include /etc/letsencrypt/aitool/ingress.conf;');
    expect(nginx).toContain('limit_conn aitool_total 32;');
    expect(nginx).toContain('limit_conn aitool_files 16;');
    expect(nginx).toContain('proxy_max_temp_file_size 0;');
    expect(nginx).toContain('http://host.docker.internal:18769');
    expect(compose).toContain('host.docker.internal:${AI_TOOL_UPSTREAM_IP:-host-gateway}');
    expect(nginx).toContain('location = /scan');
    expect(nginx).toContain("'wasm-unsafe-eval'");
    expect(nginx).toContain('limit_req zone=aitool_parse burst=2 nodelay;');
  });

  it('includes dual-site and effective budget checks in production verification', async () => {
    const verify = await readFile('infra/scripts/ecs-verify.sh', 'utf8');
    expect(verify).toContain('verify_ai_gateway ||');
    expect(verify.indexOf('verify_ai_gateway ||')).toBeLessThan(
      verify.indexOf('echo "[verify] complete"'),
    );
    expect(verify).toContain('/static/scan/worker.js');
    expect(verify).toContain('--property=MemorySwapMax');
  });
});

function runBudget(overrides: Record<string, string> = {}) {
  const bash =
    process.platform === 'win32'
      ? ['C:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/usr/bin/bash.exe'].find(
          existsSync,
        )
      : 'bash';
  expect(bash, 'existing Bash runtime is required').toBeDefined();
  const root = resolve('runtime/audit/shared-gateway-tests');
  mkdirSync(root, { recursive: true });
  const directory = mkdtempSync(join(root, 'budget-'));
  const bin = join(directory, 'bin');
  mkdirSync(bin);
  const calls = join(directory, 'calls');
  const script = join(directory, 'update.sh');
  writeFileSync(
    script,
    readFileSync('infra/scripts/ecs-update.sh', 'utf8')
      .replaceAll(
        '/var/lock/schedule-release.lock',
        join(directory, 'release.lock').replaceAll('\\', '/'),
      )
      .replaceAll(
        '/opt/schedule/runtime/ai-resource-profiles',
        join(directory, 'profiles').replaceAll('\\', '/'),
      )
      .replaceAll('/opt/schedule', directory.replaceAll('\\', '/')),
  );
  const commands: Record<string, string> = {
    id: 'echo "${TEST_UID:-0}"',
    flock: 'exit "${TEST_LOCK_BUSY:-0}"',
    install: 'mkdir -p "${@: -1}"',
    chmod: 'exit 0',
    cat: 'case "$*" in *cpu.max*) echo "100000 100000" ;; *) echo "${TEST_SWAP:-38342656}" ;; esac',
    stat: 'if [ "$2" = "%u" ]; then echo 0; elif [ -d "${@: -1}" ]; then echo 0:0/700; else echo 0:0/600; fi',
    systemctl: `
case "$1" in
  is-active) [ "\${TEST_UNIT_INACTIVE:-0}" = '0' ] || exit 1; echo active ;;
  show)
    case "$*" in
      *ControlGroup*) echo "\${TEST_GROUP:-/system.slice/aitool.service}" ;;
      *MemoryCurrent*) echo "\${TEST_MEMORY:-12906496}" ;;
      *CPUWeight*|*IOWeight*) echo '[not set]' ;;
      *MemoryHigh*|*MemorySwapMax*) echo infinity ;;
      *MemoryMax*) echo 629145600 ;;
      *TasksMax*) echo 256 ;;
      *) exit 1 ;;
    esac ;;
  set-property)
    printf '%s\\n' "$*" >> "$TEST_CALLS"
    if [ "\${TEST_WRITE_FAIL:-0}" = '1' ] && [[ "$*" = *MemoryMax=384M* ]]; then exit 1; fi ;;
  *) exit 1 ;;
esac`,
  };
  for (const [name, body] of Object.entries(commands)) {
    const path = join(bin, name);
    writeFileSync(path, `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(path, 0o755);
  }
  try {
    const binPath = bin
      .replaceAll('\\', '/')
      .replace(/^([A-Za-z]):/u, (_, drive: string) => `/${drive.toLowerCase()}`);
    const result = spawnSync(
      bash!,
      [
        '--noprofile',
        '--norc',
        '-c',
        'export PATH="$1:$PATH"; exec "$BASH" "$2" --apply-ai-isolation',
        'budget-fixture',
        binPath,
        script,
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, TEST_CALLS: calls.replaceAll('\\', '/'), ...overrides },
      },
    );
    return {
      status: result.status,
      calls: (() => {
        try {
          return readFileSync(calls, 'utf8');
        } catch {
          return '';
        }
      })(),
      output: result.stdout + result.stderr,
    };
  } finally {
    expect(dirname(resolve(directory))).toBe(root);
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('AI resource isolation control (real Bash, synthetic systemd)', () => {
  it('applies one persistent budget to the independent AI unit', () => {
    const result = runBudget();
    expect(result.status, result.output).toBe(0);
    expect(result.calls).toContain('set-property aitool.service CPUQuota=50%');
    expect(result.calls).toContain('MemoryMax=384M');
    expect(result.calls).toContain('MemorySwapMax=64M');
    expect(result.calls).not.toContain('--runtime');
    expect(result.calls).not.toMatch(/restart|medical-schedule/u);
  });

  it('restores the previous effective unit properties after a failed property write', () => {
    const result = runBudget({ TEST_WRITE_FAIL: '1' });
    expect(result.status).not.toBe(0);
    expect(result.calls).toContain('MemoryMax=384M');
    expect(result.calls).toContain('CPUQuota=100%');
    expect(result.calls).toContain('MemoryMax=629145600');
    expect(result.calls).toContain('MemorySwapMax=infinity');
  });

  it.each([
    { TEST_MEMORY: '402653184' },
    { TEST_SWAP: '67108864' },
    { TEST_UID: '1000' },
    { TEST_LOCK_BUSY: '1' },
    { TEST_UNIT_INACTIVE: '1' },
    { TEST_GROUP: '/other/service' },
    { TEST_MEMORY: 'unknown' },
  ])('rejects unsafe application before any unit write (%j)', (input) => {
    const result = runBudget(input);
    expect(result.status).not.toBe(0);
    expect(result.calls).toBe('');
  });
});

it('rejects failed Nginx syntax while previously loaded workers can still answer requests', () => {
  const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
  const root = resolve('runtime/audit/shared-gateway-tests');
  mkdirSync(root, { recursive: true });
  const directory = mkdtempSync(join(root, 'verify-'));
  const cpuFile = join(directory, 'cpu.max').replaceAll('\\', '/');
  writeFileSync(cpuFile, '50000 100000\n');
  const source = readFileSync('infra/scripts/ecs-verify.sh', 'utf8');
  const body = source.match(/^verify_ai_gateway\(\) \{[\s\S]*?^\}/mu)?.[0];
  expect(body).toBeDefined();
  const program = `set -Eeuo pipefail
DEPLOY_DIR=fixture
grep() { return 0; }
systemctl() {
  case "$*" in
    *ControlGroup*) echo /system.slice/aitool.service ;;
    *MemoryHigh*) echo 201326592 ;;
    *MemorySwapMax*) echo 67108864 ;;
    *MemoryMax*) echo 402653184 ;;
    *CPUWeight*|*IOWeight*) echo 20 ;;
    *TasksMax*) echo 128 ;;
    is-active*) return 0 ;;
    *) return 1 ;;
  esac
}
docker() { if [[ "$*" = *"nginx -t"* ]]; then return 9; fi; echo 172.20.0.1; }
ss() { echo 'LISTEN 0 128 172.20.0.1:18769 0.0.0.0:*'; }
curl() { if [[ "$*" = *isolation-check* ]]; then echo 403; fi; return 0; }
${body!.replace('/sys/fs/cgroup${group}/cpu.max', cpuFile)}
verify_ai_gateway || exit 7
`;
  try {
    const result = spawnSync(bash, ['--noprofile', '--norc', '-c', program], { encoding: 'utf8' });
    expect(result.status, result.stdout + result.stderr).toBe(7);
  } finally {
    expect(dirname(resolve(directory))).toBe(root);
    rmSync(directory, { recursive: true, force: true });
  }
});

const upstreamCases: Array<[string, string, boolean]> = [
  ['OTHER_SETTING=kept\n', '172.20.0.1', true],
  ['OTHER_SETTING=kept\nAI_TOOL_UPSTREAM_IP=172.20.0.2\n', '172.20.0.1', true],
  ['OTHER_SETTING=kept\n AI_TOOL_UPSTREAM_IP = old\n', '172.20.0.1', true],
  ['OTHER_SETTING=kept\n', '0.0.0.0', false],
  ['AI_TOOL_UPSTREAM_IP=172.20.0.2\nAI_TOOL_UPSTREAM_IP=172.20.0.3\n', '172.20.0.1', false],
];

it.each(upstreamCases)(
  'registers only a private backend while preserving other settings (%s)',
  (initial, address, succeeds) => {
    const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
    const root = resolve('runtime/audit/shared-gateway-tests');
    mkdirSync(root, { recursive: true });
    const directory = mkdtempSync(join(root, 'upstream-'));
    const environment = join(directory, '.env.production');
    writeFileSync(environment, initial);
    const source = readFileSync('infra/scripts/ecs-update.sh', 'utf8');
    const body = source.match(/^configure_ai_tool_upstream\(\) \{[\s\S]*?^\}/mu)?.[0];
    expect(body).toBeDefined();
    const program = `set -Eeuo pipefail
ss() { echo "LISTEN 0 128 $TEST_ADDRESS:18769 0.0.0.0:*"; }
python3() { [ "\${@: -1}" = '172.20.0.1' ]; }
stat() { echo 0:0/600; }
chmod() { return 0; }
chown() { return 0; }
${body!.replaceAll('/opt/schedule', directory.replaceAll('\\', '/'))}
configure_ai_tool_upstream
`;
    try {
      const result = spawnSync(bash, ['--noprofile', '--norc', '-c', program], {
        encoding: 'utf8',
        env: { ...process.env, TEST_ADDRESS: address },
      });
      const updated = readFileSync(environment, 'utf8');
      if (succeeds) {
        expect(result.status, result.stdout + result.stderr).toBe(0);
        expect(updated).toContain('OTHER_SETTING=kept');
        expect(updated.match(/^AI_TOOL_UPSTREAM_IP=/gmu)).toHaveLength(1);
        expect(updated).toContain('AI_TOOL_UPSTREAM_IP=172.20.0.1');
      } else {
        expect(result.status).not.toBe(0);
        expect(updated).toBe(initial);
      }
    } finally {
      expect(dirname(resolve(directory))).toBe(root);
      rmSync(directory, { recursive: true, force: true });
    }
  },
);
