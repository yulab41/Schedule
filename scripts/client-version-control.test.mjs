import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../', import.meta.url));
const bash =
  process.platform === 'win32'
    ? ['C:/Program Files/Git/bin/bash.exe', 'C:/Program Files/Git/usr/bin/bash.exe'].find(
        existsSync,
      )
    : 'bash';
const source = readFileSync(path.join(root, 'infra/scripts/client-version-allowlist.sh'), 'utf8');
const old = '1.0.0',
  current = '2.0.0';
const curlStub = `import fs from 'node:fs';
const a=process.argv.slice(2), dir=process.cwd();
const env=Object.fromEntries(fs.readFileSync(dir+'/running.env','utf8').trim().split('\\n').map(x=>x.split('=')));
const list=env.MINIPROGRAM_SUPPORTED_CLIENT_VERSIONS.split(',');
const version=a.find(x=>x.startsWith('version='))?.slice(8);
fs.appendFileSync(dir+'/probes.log',(version??'health')+'\\n');
const mode=process.env.FAULT, changed=list.includes('2.0.0');
if(!version){if(mode==='health'&&changed)process.exit(22); console.log('{}');process.exit(0);}
const supported=list.includes(version)||(mode==='old-still-accepted'&&changed&&version==='1.0.0');
if(a.includes('-w')){process.stdout.write(supported?'200':'426');process.exit(0);}
if(!supported)process.exit(22);
const names={global:'GLOBAL',core:'CORE',workflows:'WORKFLOWS',organization:'ORGANIZATION',insights:'INSIGHTS',externalMessages:'EXTERNAL_MESSAGES',guest:'GUEST'};
const global=env.MINIPROGRAM_CAPABILITY_GLOBAL_ENABLED==='true';
const data={platform:'miniprogram',version,...Object.fromEntries(Object.entries(names).map(([n,k])=>[n,global&&env['MINIPROGRAM_CAPABILITY_'+k+'_ENABLED']==='true']))};
if(mode==='wrong-json'&&changed)data.unexpected=true;
console.log(JSON.stringify(data));`;

function fixture(list = old) {
  const parent = path.join(root, 'runtime/codex/client-version-control-tests');
  mkdirSync(parent, { recursive: true });
  const dir = mkdtempSync(path.join(parent, 'case-'));
  mkdirSync(path.join(dir, 'deploy'));
  const env =
    `OTHER=keep-exactly\nMINIPROGRAM_SUPPORTED_CLIENT_VERSIONS=${list}\nMINIPROGRAM_LEGACY_CLIENT_VERSION=${old}\n` +
    ['GLOBAL', 'CORE', 'WORKFLOWS', 'ORGANIZATION', 'INSIGHTS', 'EXTERNAL_MESSAGES', 'GUEST']
      .map((k) => `MINIPROGRAM_CAPABILITY_${k}_ENABLED=true\n`)
      .join('');
  writeFileSync(path.join(dir, 'deploy/.env.production'), env);
  writeFileSync(path.join(dir, 'running.env'), env);
  writeFileSync(path.join(dir, 'curl.mjs'), curlStub);
  return { dir, env };
}

function execute(f, args, fault = '', probeScript) {
  expect(bash, 'Use the existing Bash runtime; never install').toBeDefined();
  let body = source;
  if (probeScript !== undefined) {
    const script = readFileSync(path.join(root, 'infra/scripts', probeScript), 'utf8');
    const probe =
      probeScript === 'ecs-verify.sh'
        ? 'verify_miniprogram_capabilities'
        : 'probe_effective_capabilities';
    const functions = [
      'env_value',
      'compose',
      'probe_capability_version',
      'probe_rejected_client_version',
      probe,
    ].map((name) => {
      const value = script.match(new RegExp('^' + name + '\\(\\) \\{[\\s\\S]*?^\\}', 'm'))?.[0];
      expect(value, name).toBeDefined();
      return value;
    });
    body =
      'set -Eeuo pipefail\nDEPLOY_DIR="$FIXTURE/deploy"\nENV_FILE="$DEPLOY_DIR/.env.production"\nCOMPOSE_FILE=synthetic\nDOMAIN=synthetic.invalid\n' +
      functions.join('\n') +
      '\n' +
      probe +
      '\n';
  }
  if (probeScript === undefined) {
    for (const [from, to] of [
      ['DEPLOY_DIR="/opt/schedule"', 'DEPLOY_DIR="$FIXTURE/deploy"'],
      ['exec 8>/var/lock/schedule-release.lock', 'exec 8>"$FIXTURE/release.lock"'],
      ['exec 9>/var/lock/schedule-client-capability.lock', 'exec 9>"$FIXTURE/capability.lock"'],
    ]) {
      expect(body.split(from)).toHaveLength(2);
      body = body.replace(from, to);
    }
  }
  const stubs = `FIXTURE="$PWD"
MAIN_PID="$BASHPID"
id(){ printf 0; }
stat(){ case "$2" in '%u:%g/%a') printf '0:0/600';; '%u') printf 0;; '%a') printf 600;; *) return 91;; esac; }
chown(){ :; }
chmod(){ :; }
flock(){ [ "$FAULT" != lock ]; }
sleep(){ :; }
curl(){ (cd "$FIXTURE"; command node "$FIXTURE/curl.mjs" "$@"); }
docker(){
  while [ "$#" -gt 0 ]; do
    case "$1" in
      up)
        printf 'recreate\\n' >> "$FIXTURE/docker.log"
        if [ ! -f "$FIXTURE/fault-used" ]; then
          case "$FAULT" in
            recreate) touch "$FIXTURE/fault-used"; return 42;;
            TERM|HUP) touch "$FIXTURE/fault-used"; kill -"$FAULT" "$MAIN_PID"; return 0;;
            EXIT) touch "$FIXTURE/fault-used"; exit 23;;
          esac
        fi
        cp "$ENV_FILE" "$FIXTURE/running.env"; return 0;;
      node) shift; command node "$@"; return $?;;
    esac
    shift
  done
  return 92
}
`;
  writeFileSync(path.join(f.dir, 'control.sh'), stubs + body);
  return new Promise((resolve, reject) => {
    const child = spawn(bash, ['--noprofile', '--norc', './control.sh', ...args], {
      cwd: f.dir,
      windowsHide: true,
      env: { ...process.env, FAULT: fault },
    });
    let stdout = '',
      stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Synthetic control timed out'));
    }, 20000);
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });
  });
}

describe('exact version retirement control (real Bash, synthetic system and network)', () => {
  it.each(['client-capability-switch.sh', 'ecs-verify.sh'])(
    'checks every supported version and excludes legacy in %s',
    async (script) => {
      const f = fixture('2.0.0,3.0.0');
      const result = await execute(f, [], '', script);
      expect(result.status, result.stderr).toBe(0);
      const probes = readFileSync(path.join(f.dir, 'probes.log'), 'utf8');
      for (const version of ['1.0.0', '2.0.0', '3.0.0']) expect(probes).toContain(version + '\n');
      expect((await execute(f, [], 'wrong-json', script)).status).not.toBe(0);
      expect((await execute(f, [], 'old-still-accepted', script)).status).not.toBe(0);
    },
    30000,
  );
  it('ensures add-only, replaces exactly without changing legacy, and verifies idempotently', async () => {
    const f = fixture();
    let r = await execute(f, ['ensure', current]);
    expect(r.status, r.stderr).toBe(0);
    expect(readFileSync(path.join(f.dir, 'deploy/.env.production'), 'utf8')).toBe(
      f.env.replace(`=${old}\n`, `=${old},${current}\n`),
    );
    r = await execute(f, ['replace', current]);
    expect(r.status, r.stderr).toBe(0);
    const expected = f.env.replace(`VERSIONS=${old}`, `VERSIONS=${current}`);
    expect(readFileSync(path.join(f.dir, 'deploy/.env.production'), 'utf8')).toBe(expected);
    const calls = readFileSync(path.join(f.dir, 'docker.log'), 'utf8');
    for (const args of [['replace', current], ['verify']]) {
      r = await execute(f, args);
      expect(r.status, r.stderr).toBe(0);
    }
    expect(readFileSync(path.join(f.dir, 'docker.log'), 'utf8')).toBe(calls);
    expect(readFileSync(path.join(f.dir, 'probes.log'), 'utf8')).toContain(old);
  }, 30000);

  it.each([[], [current, current], ['invalid'], ['']].map((versions) => [versions]))(
    'rejects invalid replacement %j without a write',
    async (versions) => {
      const f = fixture(),
        r = await execute(f, ['replace', ...versions]);
      expect(r.status).not.toBe(0);
      expect(readFileSync(path.join(f.dir, 'deploy/.env.production'), 'utf8')).toBe(f.env);
      expect(existsSync(path.join(f.dir, 'docker.log'))).toBe(false);
    },
  );

  it.each(['recreate', 'health', 'wrong-json', 'old-still-accepted', 'TERM', 'HUP', 'EXIT'])(
    'restores and verifies previous policy after %s',
    async (fault) => {
      const f = fixture(),
        r = await execute(f, ['replace', current], fault);
      expect(r.status, r.stdout).not.toBe(0);
      expect(readFileSync(path.join(f.dir, 'deploy/.env.production'), 'utf8')).toBe(f.env);
      expect(readFileSync(path.join(f.dir, 'running.env'), 'utf8')).toBe(f.env);
      expect(
        readFileSync(path.join(f.dir, 'docker.log'), 'utf8').trim().split('\n').length,
      ).toBeGreaterThanOrEqual(2);
      expect(r.stdout).not.toContain('已替换');
    },
    30000,
  );

  it('verifies an already-retired legacy and never mutates on lock failure', async () => {
    const f = fixture(current);
    expect((await execute(f, ['verify'])).status).toBe(0);
    expect((await execute(f, ['ensure', '3.0.0'], 'lock')).status).not.toBe(0);
    expect(readFileSync(path.join(f.dir, 'deploy/.env.production'), 'utf8')).toBe(f.env);
  });
});
