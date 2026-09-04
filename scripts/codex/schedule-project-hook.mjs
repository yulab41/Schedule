/* global console, process */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const SCHEDULE_HOOK_CONTEXT =
  'Schedule project: dependency mode=REUSE_ONLY. Load schedule-project-guardrails. New/resumed, branch/SHA changes, or missing dist never authorize install. Use a healthy worktree or exclusive warm slot; none means fail closed—never cold-install.';
export const DEPENDENCY_MUTATION_REASON =
  'TASK_STATUS=BLOCKED_DEPENDENCY_MUTATION\nINSTALL_INVOKED=false\nREASON=Schedule defaults to REUSE_ONLY; current user message has no dependency-maintenance authorization.';
export const DANGEROUS_DEPENDENCY_SUBCOMMANDS = new Set([
  'install',
  'i',
  'add',
  'remove',
  'rm',
  'update',
  'up',
  'fetch',
  'rebuild',
  'prune',
]);
export const SHELL_TOOL_PATTERN = /(?:bash|cmd|command|exec|powershell|pwsh|shell|terminal)/iu;

const SCRIPT_PATH = fileURLToPath(import.meta.url);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalPath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLocaleLowerCase('en-US') : resolved;
}

function isPathInside(parent, child) {
  const relative = path.relative(canonicalPath(parent), canonicalPath(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function commandBase(value) {
  return String(value ?? '').replaceAll('\\', '/').split('/').pop().toLocaleLowerCase('en-US');
}

function commandName(value) {
  return commandBase(value).replace(/\.(?:cmd|exe|ps1|bat|sh)$/u, '');
}

function pushToken(segment, value) {
  if (value !== '') segment.push(value);
}

export function tokenizeShell(source) {
  const segments = [];
  let segment = [];
  let value = '';
  let quote = undefined;
  const flush = () => {
    pushToken(segment, value);
    value = '';
  };
  const flushSegment = () => {
    flush();
    if (segment.length > 0) segments.push(segment);
    segment = [];
  };
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote !== undefined) {
      if (character === quote) {
        quote = undefined;
      } else if (character === '\\' && source[index + 1] === quote) {
        value += source[index + 1];
        index += 1;
      } else if (quote === '`' && character === '`' && source[index + 1] !== undefined) {
        value += source[index + 1];
        index += 1;
      } else {
        value += character;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === '\\' && source[index + 1] === '"') {
      value += source[index + 1];
      index += 1;
      continue;
    }
    if (/\s/u.test(character)) {
      flush();
      continue;
    }
    if (';&|()'.includes(character)) {
      flushSegment();
      if ((character === '&' || character === '|') && source[index + 1] === character) index += 1;
      continue;
    }
    value += character;
  }
  flushSegment();
  return segments;
}

function optionName(value) {
  return value.toLocaleLowerCase('en-US').split('=', 1)[0];
}

function commandStart(tokens) {
  let index = 0;
  if (commandName(tokens[index]) === 'env') index += 1;
  while (index < tokens.length && /^[a-z_][a-z0-9_]*=/iu.test(tokens[index])) index += 1;
  return index;
}

function findSubcommand(tokens, start) {
  const optionsWithValue = new Set([
    '--filter',
    '--dir',
    '--workspace-concurrency',
    '--aggregate-output',
    '--reporter',
    '--prefix',
    '--cwd',
    '-c',
    '-C',
  ]);
  for (let index = start; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '--') return { index: index + 1, value: tokens[index + 1]?.toLocaleLowerCase('en-US') };
    if (token.startsWith('-') || token.startsWith('/')) {
      const name = optionName(token);
      if (!token.includes('=') && optionsWithValue.has(name)) index += 1;
      continue;
    }
    return { index, value: token.toLocaleLowerCase('en-US') };
  }
  return { index: -1, value: undefined };
}

function hasFlag(tokens, flag) {
  const wanted = flag.toLocaleLowerCase('en-US');
  return tokens.some((token) => {
    const normalized = token.toLocaleLowerCase('en-US');
    if (normalized === wanted) return true;
    if (wanted.startsWith('-') && normalized.startsWith('-') && !normalized.startsWith('--')) {
      return normalized.slice(1).includes(wanted.slice(1));
    }
    return false;
  });
}

function isMutationCommand(tokens) {
  const first = findSubcommand(tokens, commandStart(tokens));
  if (first.index < 0) return false;
  const name = commandName(tokens[first.index]);
  const subcommand = findSubcommand(tokens, first.index + 1);
  if (name === 'pnpm') {
    if (DANGEROUS_DEPENDENCY_SUBCOMMANDS.has(subcommand.value)) return true;
    return subcommand.value === 'store' && findSubcommand(tokens, subcommand.index + 1).value === 'prune';
  }
  if (name === 'npm') return ['install', 'i', 'ci', 'update', 'uninstall'].includes(subcommand.value);
  if (name === 'yarn') return ['install', 'add', 'remove', 'upgrade'].includes(subcommand.value);
  return false;
}

function nestedCommand(tokens, names, switches) {
  const first = findSubcommand(tokens, commandStart(tokens));
  if (first.index < 0 || !names.has(commandName(tokens[first.index]))) return undefined;
  for (let index = first.index + 1; index < tokens.length; index += 1) {
    const name = optionName(tokens[index]);
    if (switches.has(name)) return tokens.slice(index + 1).join(' ');
  }
  return undefined;
}

function cleanupTarget(tokens) {
  return tokens
    .slice(commandStart(tokens) + 1)
    .map((token) => token.toLocaleLowerCase('en-US').replaceAll('\\', '/'))
    .join(' ');
}

function isRecursiveCleanup(tokens) {
  const start = commandStart(tokens);
  const command = commandName(tokens[start]);
  if (!['rm', 'rmdir', 'rd', 'del', 'erase', 'remove-item'].includes(command)) return false;
  return hasFlag(tokens.slice(start), '-r') || hasFlag(tokens.slice(start), '-recurse') || hasFlag(tokens.slice(start), '/s');
}

function hasDependencyTarget(tokens) {
  const target = cleanupTarget(tokens);
  return /(?:^|[\s/'"`])node_modules(?:[\s/'"`]|$)|\.pnpm-store|(?:^|[\s/'"`])pnpm-store(?:[\s/'"`]|$)/iu.test(target);
}

function isGitCleanMutation(tokens, poolRoot, cwd) {
  const start = commandStart(tokens);
  if (commandName(tokens[start]) !== 'git' || commandName(tokens[start + 1]) !== 'clean') return false;
  const flags = tokens.slice(start + 2).filter((token) => /^-{1,2}[a-z]+$/iu.test(token));
  const joined = flags.join('').toLocaleLowerCase('en-US');
  if (joined.includes('x') && joined.includes('f') && joined.includes('d')) return true;
  return isPathInside(poolRoot, cwd);
}

export function classifyCommand(command, { cwd = process.cwd(), poolRoot = '' } = {}) {
  const segments = tokenizeShell(String(command ?? ''));
  for (const tokens of segments) {
    if (tokens.length === 0) continue;
    const nestedPowerShell = nestedCommand(tokens, new Set(['powershell', 'pwsh']), new Set(['-command', '-c']));
    if (nestedPowerShell !== undefined && classifyCommand(nestedPowerShell, { cwd, poolRoot }).blocked) {
      return { blocked: true, reason: 'nested shell dependency mutation' };
    }
    const nestedCmd = nestedCommand(tokens, new Set(['cmd']), new Set(['/c', '/k']));
    if (nestedCmd !== undefined && classifyCommand(nestedCmd, { cwd, poolRoot }).blocked) {
      return { blocked: true, reason: 'nested shell dependency mutation' };
    }
    const nestedBash = nestedCommand(tokens, new Set(['bash', 'sh', 'zsh']), new Set(['-c']));
    if (nestedBash !== undefined && classifyCommand(nestedBash, { cwd, poolRoot }).blocked) {
      return { blocked: true, reason: 'nested shell dependency mutation' };
    }
    const firstCommand = commandName(tokens[commandStart(tokens)]);
    if (firstCommand === 'start-process' || firstCommand === 'start') {
      const managerIndex = tokens.findIndex((token) => ['pnpm', 'npm', 'yarn'].includes(commandName(token)));
      if (managerIndex >= 0 && isMutationCommand(tokens.slice(managerIndex))) {
        return { blocked: true, reason: 'indirect dependency mutation' };
      }
    }
    if (isMutationCommand(tokens)) return { blocked: true, reason: 'dependency mutation' };
    if (isGitCleanMutation(tokens, poolRoot, cwd)) return { blocked: true, reason: 'destructive git clean' };
    const cleanup = isRecursiveCleanup(tokens);
    if (cleanup && (hasDependencyTarget(tokens) || isPathInside(poolRoot, cwd))) {
      return { blocked: true, reason: 'destructive dependency or persistent-slot cleanup' };
    }
    if (cleanup && poolRoot && tokens.slice(1).some((token) => {
      try {
        const targetPath = path.isAbsolute(token) ? token : path.resolve(cwd, token);
        return isPathInside(poolRoot, targetPath);
      } catch { return false; }
    })) {
      return { blocked: true, reason: 'destructive persistent-slot cleanup' };
    }
  }
  return { blocked: false, reason: undefined };
}

function readJson(filePath, fsImpl = fs) {
  try { return JSON.parse(fsImpl.readFileSync(filePath, 'utf8')); }
  catch { return undefined; }
}

function resolveConfiguredPath(root, value, fallback) {
  const configured = value ?? fallback;
  return path.isAbsolute(configured) ? path.resolve(configured) : path.resolve(root, configured);
}

function runGit(cwd, arguments_, spawn = spawnSync) {
  const result = spawn('git', ['-C', cwd, ...arguments_], { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) return undefined;
  return String(result.stdout ?? '').trim();
}

export function detectScheduleProject({ cwd, config, git = runGit, fsImpl = fs }) {
  if (!cwd || !config?.commonDir) return undefined;
  const discoveredRoot = git(cwd, ['rev-parse', '--show-toplevel']);
  const root = discoveredRoot ? path.resolve(discoveredRoot) : undefined;
  const commonRaw = git(cwd, ['rev-parse', '--git-common-dir']);
  const common = commonRaw && (path.isAbsolute(commonRaw) ? commonRaw : path.resolve(root ?? cwd, commonRaw));
  const canonicalProjectHome = common ? path.dirname(path.resolve(common)) : undefined;
  const configuredCommon = canonicalProjectHome && resolveConfiguredPath(canonicalProjectHome, config.commonDir, '.git');
  if (!root || !common || !configuredCommon || canonicalPath(common) !== canonicalPath(configuredCommon)) return undefined;
  const markers = ['pnpm-workspace.yaml', 'apps/miniprogram', 'apps/api', 'infra/docker/compose.prod.yml'];
  if (!markers.every((marker) => fsImpl.existsSync(path.join(root, marker)))) return undefined;
  const poolRoot = resolveConfiguredPath(canonicalProjectHome, config.poolRoot, 'runtime/wt');
  const stateRoot = resolveConfiguredPath(canonicalProjectHome, config.stateRoot, 'runtime/codex');
  const authorizationDir = resolveConfiguredPath(
    canonicalProjectHome,
    config.authorizationDir,
    path.join('runtime', 'codex', 'dependency-maintenance-authorizations'),
  );
  if (!isPathInside(canonicalProjectHome, poolRoot) || !isPathInside(canonicalProjectHome, stateRoot) || !isPathInside(canonicalProjectHome, authorizationDir)) return undefined;
  return { root, canonicalProjectHome, commonDir: canonicalPath(common), poolRoot, stateRoot, authorizationDir };
}

function eventValue(event, keys) {
  for (const key of keys) {
    if (typeof event?.[key] === 'string' && event[key] !== '') return event[key];
  }
  return undefined;
}

function eventCwd(event) {
  return eventValue(event, ['cwd', 'workdir', 'workspace']) ?? event?.tool_input?.cwd ?? event?.input?.cwd ?? process.cwd();
}

function eventCommand(event) {
  return event?.tool_input?.command ?? event?.input?.command ?? event?.command;
}

function eventName(event) {
  return String(process.env.CODEX_HOOK_EVENT ?? event?.hook_event_name ?? event?.event ?? event?.eventName ?? '').toLowerCase();
}

function isShellTool(event) {
  const tool = eventValue(event, ['tool_name', 'toolName', 'tool', 'name']);
  return !tool || SHELL_TOOL_PATTERN.test(tool) || eventCommand(event) !== undefined;
}

function authorizationFiles(directory, fsImpl = fs) {
  if (!directory || !fsImpl.existsSync(directory)) return [];
  return fsImpl.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLocaleLowerCase('en-US').endsWith('.json'))
    .map((entry) => path.join(directory, entry.name));
}

function authorizationHash(commonDir, command) {
  return sha256(`${canonicalPath(commonDir)}\n${String(command)}`);
}

function validAuthorization({ project, command, config, now = new Date(), fsImpl = fs }) {
  const directory = config.authorizationDir;
  for (const filePath of authorizationFiles(directory, fsImpl)) {
    const record = readJson(filePath, fsImpl);
    if (!record || record.schemaVersion !== 1 || record.singleUse !== true || record.usedAt) continue;
    if (record.commonDir !== canonicalPath(project.commonDir)) continue;
    if (record.commandHash !== authorizationHash(project.commonDir, command)) continue;
    const created = Date.parse(record.createdAt ?? '');
    const expires = Date.parse(record.expiresAt ?? '');
    if (!Number.isFinite(created) || !Number.isFinite(expires) || expires <= now.getTime()) continue;
    if (expires - created > 15 * 60_000 || typeof record.reason !== 'string' || !record.reason.trim()) continue;
    return { filePath, record };
  }
  return undefined;
}

function consumeAuthorization(authorization, fsImpl = fs) {
  if (!authorization) return;
  const updated = { ...authorization.record, usedAt: new Date().toISOString() };
  const temporary = `${authorization.filePath}.${process.pid}.tmp`;
  fsImpl.writeFileSync(temporary, `${JSON.stringify(updated, undefined, 2)}\n`, 'utf8');
  fsImpl.renameSync(temporary, authorization.filePath);
}

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export function releaseOwnedLeases({ project, event, fsImpl = fs, git = runGit }) {
  if (!project?.poolRoot || !project?.stateRoot || !fsImpl.existsSync(project.poolRoot)) return 0;
  const leaseRoot = path.join(project.stateRoot, 'leases');
  if (!fsImpl.existsSync(leaseRoot)) return 0;
  const sessionId = event?.session_id ?? event?.sessionId;
  const taskId = event?.thread_id ?? event?.taskId;
  const eventPid = Number(event?.pid);
  let released = 0;
  for (const entry of fsImpl.readdirSync(leaseRoot, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.toLocaleLowerCase('en-US').endsWith('.json')) continue;
    const leasePath = path.join(leaseRoot, entry.name);
    const lease = readJson(leasePath, fsImpl);
    if (!lease) continue;
    if (typeof lease.path !== 'string' || !isPathInside(project.poolRoot, lease.path)) continue;
    const slotPath = path.resolve(lease.path);
    if (path.dirname(canonicalPath(slotPath)) !== canonicalPath(project.poolRoot)) continue;
    if (!git(slotPath, ['rev-parse', '--show-toplevel'])) continue;
    const matchesIdentity =
      (sessionId && lease.sessionId === sessionId) ||
      (taskId && lease.taskId === taskId) ||
      (Number.isInteger(eventPid) && eventPid > 0 && eventPid === Number(lease.pid));
    if (!matchesIdentity) continue;
    const status = git(slotPath, ['status', '--porcelain=v1', '--untracked-files=all']);
    if (status === undefined || status !== '') continue;
    if (processAlive(Number(lease.pid)) && Number(lease.pid) !== eventPid) continue;
    fsImpl.rmSync(leasePath, { force: true });
    released += 1;
  }
  return released;
}

export function handleHookEvent(event, { config, now = new Date(), fsImpl = fs, git = runGit } = {}) {
  const project = detectScheduleProject({ cwd: eventCwd(event), config, fsImpl, git });
  if (!project) return undefined;
  const name = eventName(event);
  if (name === 'sessionstart' || name === 'userpromptsubmit') return { additionalContext: SCHEDULE_HOOK_CONTEXT };
  if (name === 'sessionend') {
    releaseOwnedLeases({ project, event, fsImpl, git });
    return undefined;
  }
  if (name !== 'pretooluse' || !isShellTool(event)) return undefined;
  const command = eventCommand(event);
  if (typeof command !== 'string') return undefined;
  const classification = classifyCommand(command, { cwd: project.root, poolRoot: project.poolRoot });
  if (!classification.blocked) return undefined;
  const authorization = validAuthorization({
    project,
    command,
    config: { ...config, authorizationDir: project.authorizationDir },
    fsImpl,
    now,
  });
  if (authorization) {
    consumeAuthorization(authorization, fsImpl);
    return { decision: 'allow', reason: 'user-authorized dependency maintenance' };
  }
  return { decision: 'deny', reason: DEPENDENCY_MUTATION_REASON };
}

export function main() {
  const input = fs.readFileSync(0, 'utf8').trim();
  let event = {};
  try { event = input ? JSON.parse(input) : {}; } catch { event = {}; }
  const discoveredRoot = runGit(process.cwd(), ['rev-parse', '--show-toplevel']);
  const configPath = process.env.SCHEDULE_HOOK_CONFIG ?? (
    discoveredRoot
      ? path.join(path.resolve(discoveredRoot), '.codex', 'hooks', 'project.json')
      : path.join(path.dirname(SCRIPT_PATH), '..', '..', '.codex', 'hooks', 'project.json')
  );
  const config = readJson(configPath) ?? {};
  const response = handleHookEvent(event, { config });
  if (response) console.log(JSON.stringify(response));
  return response;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  try { main(); }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
