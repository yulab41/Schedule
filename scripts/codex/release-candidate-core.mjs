import crypto from 'node:crypto';
import console from 'node:console';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { ensureWorktreeDependencies, resolveCanonicalProjectHome } from './worktree-deps-core.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const fullSha = /^[0-9a-f]{40}$/u;
const taskBranch = /^refs\/heads\/codex\/[A-Za-z0-9._/-]+$/u;
const canonical = (value) => {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};
function requireFact(condition, message) {
  if (!condition) throw new Error(`[release-candidate] ${message}`);
}
function samePath(left, right) {
  return (
    typeof left === 'string' && typeof right === 'string' && canonical(left) === canonical(right)
  );
}
function git(root, args, accepted = [0]) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  requireFact(!result.error && accepted.includes(result.status), 'Git identity check failed.');
  return { text: result.stdout.trim(), status: result.status };
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function assertApprovedPoolPath(root, worktree) {
  requireFact(
    typeof worktree === 'string' && path.isAbsolute(worktree),
    'Use an absolute warm pool path.',
  );
  requireFact(
    !/(^|[\\/])\.{1,2}([\\/]|$)/u.test(worktree),
    'Path traversal/aliases are not accepted.',
  );
  requireFact(
    samePath(path.dirname(worktree), path.join(root, 'runtime/wt')),
    'Candidate must be a direct child of the approved warm pool.',
  );
  requireFact(worktree.length <= 120, 'Candidate exceeds the Windows path budget.');
}

export function assertNoPathLinks(root, target) {
  const relative = path.relative(root, target);
  requireFact(
    relative && !relative.startsWith('..') && !path.isAbsolute(relative),
    'Path leaves the repository.',
  );
  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    requireFact(!stat.isSymbolicLink(), 'Candidate/output crosses a symbolic link or junction.');
    requireFact(
      samePath(fs.realpathSync.native(current), current),
      'Candidate/output uses a path alias.',
    );
  }
}

export function validateCandidateFacts(facts, { preparing = false } = {}) {
  const f = facts;
  assertApprovedPoolPath(f.root, f.worktree);
  requireFact(
    fullSha.test(f.expectedCommit) && f.head === f.expectedCommit,
    'HEAD differs from the expected full SHA.',
  );
  requireFact(
    f.registered && f.gitFile && samePath(f.actualTopLevel, f.worktree),
    'Candidate is not a registered standalone Git worktree.',
  );
  requireFact(
    samePath(f.commonDir, path.join(f.root, '.git')),
    'Candidate belongs to another Git common directory.',
  );
  requireFact(f.clean === true, 'Candidate has tracked, staged or untracked changes.');
  requireFact(
    f.slot?.schemaVersion === 2 && f.slot.permanence === 'permanent' && f.slot.status === 'leased',
    'Slot is absent, released or quarantined.',
  );
  requireFact(
    samePath(f.slot.path, f.worktree) && samePath(f.slot.commonDir, f.commonDir),
    'Slot registry identity differs from Git.',
  );
  const lease = f.lease;
  requireFact(
    lease?.schemaVersion === 2 && lease.status === 'leased',
    'A valid active task lease is required.',
  );
  requireFact(
    f.leaseToken && lease.token === f.leaseToken && samePath(lease.path, f.worktree),
    'Lease ownership does not match this worktree.',
  );
  requireFact(
    f.runId && lease.taskId === f.runId && lease.sessionId && lease.owner,
    'Lease belongs to another RUN_ID/session.',
  );
  const heartbeat = Date.parse(lease.lastHeartbeat);
  requireFact(
    Number.isFinite(heartbeat) && heartbeat <= f.now && f.now - heartbeat <= 240 * 60_000,
    'Base lease heartbeat has expired.',
  );
  if (lease.expiresAt !== undefined)
    requireFact(Date.parse(lease.expiresAt) > f.now, 'Base lease has expired.');
  requireFact(
    taskBranch.test(lease.branch) && f.ownerBranchHead === f.head && f.leaseAncestor === true,
    'Candidate no longer belongs to its leased task branch/base.',
  );
  requireFact(
    f.detached || (preparing && f.branch === lease.branch),
    'Upload candidate must be detached.',
  );
  const health = f.dependencies;
  requireFact(
    health?.taskStatus === 'READY_REUSE' &&
      health.dependenciesReused === true &&
      health.installInvoked === false,
    'Dependency health is not READY_REUSE.',
  );
  requireFact(
    health.dependencyFingerprint &&
      lease.dependencyFingerprint === health.dependencyFingerprint &&
      f.slot.dependencyFingerprint === health.dependencyFingerprint,
    'Lease/slot dependency fingerprint mismatch.',
  );
  const output = path.join(f.worktree, 'apps/miniprogram/dist');
  requireFact(
    typeof f.outputDirectory === 'string' && !/(^|[\\/])\.{1,2}([\\/]|$)/u.test(f.outputDirectory),
    'Output path aliases are not accepted.',
  );
  requireFact(samePath(f.outputDirectory, output), 'Output directory belongs to another task.');
  const candidate = lease.releaseCandidate;
  if (preparing && !candidate) return f;
  requireFact(
    candidate?.schemaVersion === 1 && candidate.purpose === 'upload',
    'Ordinary development leases are not upload candidates.',
  );
  requireFact(
    candidate.runId === f.runId && candidate.commit === f.head,
    'Upload purpose is bound to a different RUN_ID/SHA.',
  );
  requireFact(
    samePath(candidate.outputDirectory, output),
    'Recorded upload output belongs to another task.',
  );
  const prepared = Date.parse(candidate.preparedAt);
  const expires = Date.parse(candidate.expiresAt);
  requireFact(
    Number.isFinite(prepared) &&
      Number.isFinite(expires) &&
      prepared <= f.now &&
      expires > f.now &&
      expires > prepared &&
      expires - prepared <= 240 * 60_000,
    'Upload candidate lease has expired or invalid dates.',
  );
  return f;
}

export function validateUploadProfile(profile, facts, version) {
  requireFact(
    typeof version === 'string' &&
      /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version) &&
      !/local/iu.test(version),
    'Upload needs an explicit non-local version.',
  );
  requireFact(
    profile.schemaVersion === 1 && profile.profile === 'production' && profile.buildDirty === false,
    'Upload output must be clean production.',
  );
  requireFact(
    typeof profile.buildCommit === 'string' &&
      profile.buildCommit.length >= 7 &&
      facts.head.startsWith(profile.buildCommit),
    'Build SHA differs from candidate.',
  );
  requireFact(
    profile.buildVersion === version && profile.buildDescription?.includes(facts.head.slice(0, 7)),
    'Build version/description differs from candidate.',
  );
  const built = Date.parse(profile.buildTime);
  requireFact(
    Number.isFinite(built) &&
      built >= Date.parse(facts.lease.releaseCandidate.preparedAt) &&
      built <= facts.now,
    'Output was not freshly built for this upload lease.',
  );
  return profile;
}

function collectFacts(options, { preparing = false } = {}) {
  const root = resolveCanonicalProjectHome(path.resolve(path.dirname(scriptPath), '../..'));
  if (options.repositoryRoot)
    requireFact(samePath(options.repositoryRoot, root), 'Repository root is not canonical.');
  const worktree = options.worktree;
  assertApprovedPoolPath(root, worktree);
  assertNoPathLinks(root, worktree);
  const outputDirectory = options.outputDirectory ?? path.join(worktree, 'apps/miniprogram/dist');
  requireFact(
    samePath(outputDirectory, path.join(worktree, 'apps/miniprogram/dist')),
    'Output directory belongs to another task.',
  );
  assertNoPathLinks(root, outputDirectory);
  const slotKey = crypto.createHash('sha256').update(canonical(worktree)).digest('hex');
  const stateRoot = path.join(root, 'runtime/codex');
  const leasePath = path.join(stateRoot, 'leases', `${slotKey}.json`);
  const slotPath = path.join(stateRoot, 'state/slots', `${slotKey}.json`);
  requireFact(
    fs.existsSync(slotPath) && fs.existsSync(leasePath),
    'Candidate has no registered slot/lease.',
  );
  assertNoPathLinks(root, leasePath);
  assertNoPathLinks(root, slotPath);
  const slot = readJson(slotPath);
  const lease = readJson(leasePath);
  requireFact(
    options.runId &&
      lease.taskId === options.runId &&
      options.leaseToken &&
      lease.token === options.leaseToken,
    'Candidate lease belongs to another RUN_ID/token.',
  );
  requireFact(
    taskBranch.test(lease.branch) && fullSha.test(lease.head),
    'Lease branch/base identity is invalid.',
  );
  const head = git(worktree, ['rev-parse', 'HEAD']).text;
  const branch = git(worktree, ['symbolic-ref', '-q', 'HEAD'], [0, 1]);
  const registered = git(root, ['worktree', 'list', '--porcelain'])
    .text.split(/\r?\n/u)
    .some((line) => line.startsWith('worktree ') && samePath(line.slice(9), worktree));
  const dependencies = ensureWorktreeDependencies({
    worktree,
    mode: 'ReuseOnly',
    leaseToken: options.leaseToken,
  });
  const facts = {
    root,
    worktree,
    leasePath,
    slotPath,
    slotKey,
    slot,
    lease,
    head,
    expectedCommit: options.expectedCommit,
    runId: options.runId,
    leaseToken: options.leaseToken,
    now: Date.now(),
    dependencies,
    outputDirectory,
    registered,
    gitFile:
      fs.existsSync(path.join(worktree, '.git')) &&
      fs.lstatSync(path.join(worktree, '.git')).isFile(),
    actualTopLevel: git(worktree, ['rev-parse', '--show-toplevel']).text,
    commonDir: path.resolve(worktree, git(worktree, ['rev-parse', '--git-common-dir']).text),
    branch: branch.text || undefined,
    detached: branch.status === 1,
    ownerBranchHead: git(worktree, ['rev-parse', '--verify', `${lease.branch}^{commit}`]).text,
    leaseAncestor:
      git(worktree, ['merge-base', '--is-ancestor', lease.head, head], [0, 1]).status === 0,
    clean:
      git(worktree, ['diff', '--quiet', '--exit-code'], [0, 1]).status === 0 &&
      git(worktree, ['diff', '--cached', '--quiet', '--exit-code'], [0, 1]).status === 0 &&
      git(worktree, ['ls-files', '--others', '--exclude-standard']).text === '',
  };
  if (lease.slotId)
    requireFact(lease.slotId === slotKey, 'Lease slot ID differs from registered path.');
  return validateCandidateFacts(facts, { preparing });
}

function publicFacts(facts) {
  return {
    state: 'ready-clean-detached',
    worktree: facts.worktree,
    head: facts.head,
    runId: facts.runId,
    purpose: 'upload',
    outputDirectory: facts.outputDirectory,
    dependencyFingerprint: facts.dependencies.dependencyFingerprint,
    dependenciesReused: true,
    installInvoked: false,
    worktreeCreated: false,
  };
}

export function inspectReleaseCandidate(options) {
  const facts = collectFacts(options);
  if (options.forUpload) {
    const profilePath = path.join(facts.outputDirectory, 'build-profile.json');
    validateUploadProfile(readJson(profilePath), facts, options.version);
    requireFact(
      git(facts.worktree, ['check-ignore', '-q', '--no-index', profilePath], [0, 1]).status === 0,
      'Generated upload profile is not ignored.',
    );
  }
  return {
    ...publicFacts(facts),
    ...(options.forUpload ? { version: options.version, profile: 'production-clean' } : {}),
  };
}

export function prepareReleaseCandidate(options) {
  requireFact(options.purpose === 'upload', 'Preparation requires explicit --purpose upload.');
  const ttlMinutes = options.ttlMinutes ?? 120;
  requireFact(
    Number.isInteger(ttlMinutes) && ttlMinutes >= 1 && ttlMinutes <= 240,
    'Upload lease TTL must be 1–240 minutes.',
  );
  const initial = collectFacts(options, { preparing: true });
  const operationPath = `${initial.leasePath}.operation`;
  let fd;
  try {
    fd = fs.openSync(operationPath, 'wx');
  } catch {
    throw new Error('[release-candidate] Lease operation is busy; no candidate was changed.');
  }
  let temporary;
  try {
    const current = collectFacts(options, { preparing: true });
    const lease = current.lease;
    if (!current.detached) git(current.worktree, ['switch', '--detach', current.head]);
    if (!lease.releaseCandidate) {
      const preparedAt = Date.now();
      lease.releaseCandidate = {
        schemaVersion: 1,
        purpose: 'upload',
        runId: current.runId,
        commit: current.head,
        outputDirectory: current.outputDirectory,
        preparedAt: new Date(preparedAt).toISOString(),
        expiresAt: new Date(preparedAt + ttlMinutes * 60_000).toISOString(),
      };
      temporary = `${current.leasePath}.${crypto.randomUUID()}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify(lease, null, 2) + '\n', { flag: 'wx' });
      fs.renameSync(temporary, current.leasePath);
      temporary = undefined;
    }
    return inspectReleaseCandidate(options);
  } finally {
    fs.closeSync(fd);
    if (temporary && fs.existsSync(temporary)) fs.unlinkSync(temporary);
    fs.unlinkSync(operationPath);
  }
}

export function parseCandidateArguments(args) {
  const options = {};
  const values = {
    '--repo': 'repositoryRoot',
    '--worktree': 'worktree',
    '--expected-commit': 'expectedCommit',
    '--lease-token': 'leaseToken',
    '--run-id': 'runId',
    '--version': 'version',
    '--output': 'outputDirectory',
  };
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--for-upload') {
      options.forUpload = true;
      continue;
    }
    const key = values[args[index]];
    requireFact(
      key && args[index + 1] && !args[index + 1].startsWith('--'),
      'Unknown or missing candidate argument.',
    );
    options[key] = args[++index];
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  try {
    console.log(
      JSON.stringify(inspectReleaseCandidate(parseCandidateArguments(process.argv.slice(2)))),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
