#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, readdir, rmdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { assertNoPathLinks } from '../../../scripts/codex/release-candidate-core.mjs';

const execFileAsync = promisify(execFile);
const THIS_FILE = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const FULL_COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const GIT_OBJECT_PATTERN = /^[a-f0-9]{40}$/u;
const MANIFEST_DIGEST_PATTERN = /^[a-f0-9]{64}$/u;
const PLATFORM_ACTIONS = new Set(['dry-run-only', 'uploaded']);

export const TRIAL_HISTORY_PATH = path.join(
  REPOSITORY_ROOT,
  'apps',
  'miniprogram',
  'release',
  'trial-history.v1.json',
);
export const TRIAL_POLICY_PATH = path.join(
  REPOSITORY_ROOT,
  'apps',
  'miniprogram',
  'release',
  'trial-lineage-policy.v1.json',
);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value, label) {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  return value;
}

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function requireFullCommit(value, label) {
  const commit = requireText(value, label).toLowerCase();
  if (!FULL_COMMIT_PATTERN.test(commit)) {
    throw new Error(`${label} must be a full 40-character Git commit.`);
  }
  return commit;
}

function requireGitObject(value, label) {
  const object = requireText(value, label).toLowerCase();
  if (!GIT_OBJECT_PATTERN.test(object)) {
    throw new Error(`${label} must be a full 40-character Git object id.`);
  }
  return object;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function parseJsonFile(filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read ${label} at ${filePath}.`, { cause: error });
  }
}

function validateEquivalentProof(proof, label) {
  requireRecord(proof, label);
  if (proof.strategy !== 'canonical-tree-files') {
    throw new Error(`${label} strategy must be canonical-tree-files.`);
  }
  requireText(proof.evidence, `${label} evidence`);
  if (!Array.isArray(proof.files) || proof.files.length === 0) {
    throw new Error(`${label} must list at least one canonical file.`);
  }

  const paths = new Set();
  for (const [index, file] of proof.files.entries()) {
    requireRecord(file, `${label} file ${index}`);
    const filePath = requireText(file.path, `${label} file ${index} path`);
    if (
      !/^[A-Za-z0-9._/-]+$/u.test(filePath) ||
      filePath.startsWith('/') ||
      filePath.includes('..') ||
      filePath.includes('//')
    ) {
      throw new Error(`${label} file ${index} path must be a safe repository-relative path.`);
    }
    if (paths.has(filePath)) throw new Error(`${label} file ${index} path is duplicated.`);
    paths.add(filePath);
    requireGitObject(file.blob, `${label} file ${index} blob`);
  }

  return proof;
}

export function loadTrialHistory(filePath = TRIAL_HISTORY_PATH) {
  return parseJsonFile(filePath, 'trial history');
}

export function loadTrialPolicy(filePath = TRIAL_POLICY_PATH) {
  return parseJsonFile(filePath, 'trial lineage policy');
}

export function validateTrialPolicy(policy) {
  requireRecord(policy, 'Trial lineage policy');
  if (policy.schemaVersion !== 1) throw new Error('Trial lineage policy schemaVersion must be 1.');
  if (!Number.isSafeInteger(policy.lastSequence) || policy.lastSequence < 1) {
    throw new Error('Trial lineage policy lastSequence must be a positive integer.');
  }

  for (const field of ['mainBranch', 'remote', 'tagPrefix', 'versionPrefix']) {
    requireText(policy[field], `Trial lineage policy ${field}`);
  }
  if (policy.tagPrefix !== 'miniprogram-trial/') {
    throw new Error('Trial lineage policy tagPrefix must be "miniprogram-trial/".');
  }
  if (!/^[0-9A-Za-z.-]+$/u.test(policy.versionPrefix)) {
    throw new Error('Trial lineage policy versionPrefix contains unsupported characters.');
  }
  if (!/^[0-9A-Za-z._/-]+$/u.test(policy.remote) || policy.remote.includes('..')) {
    throw new Error('Trial lineage policy remote contains unsupported characters.');
  }
  if (!/^[0-9A-Za-z._/-]+$/u.test(policy.mainBranch) || policy.mainBranch.includes('..')) {
    throw new Error('Trial lineage policy mainBranch contains unsupported characters.');
  }
  if (!Array.isArray(policy.requiredCheckpoints) || policy.requiredCheckpoints.length === 0) {
    throw new Error('Trial lineage policy must contain at least one required checkpoint.');
  }

  const configuredCommits = new Set();
  for (const [index, checkpoint] of policy.requiredCheckpoints.entries()) {
    requireRecord(checkpoint, `Required checkpoint ${index}`);
    const commit = requireFullCommit(checkpoint.commit, `Required checkpoint ${index} commit`);
    requireText(checkpoint.reason, `Required checkpoint ${commit.slice(0, 7)} reason`);
    if (configuredCommits.has(commit)) {
      throw new Error(`Required checkpoint ${commit} is duplicated.`);
    }
    configuredCommits.add(commit);
    if (checkpoint.equivalentProof !== undefined) {
      validateEquivalentProof(
        checkpoint.equivalentProof,
        `Required checkpoint ${commit} equivalentProof`,
      );
    }
  }

  return policy;
}

export function parseTrialVersion(value, policy = loadTrialPolicy()) {
  validateTrialPolicy(policy);
  const version = requireText(value, 'Trial version');
  const pattern = new RegExp(
    `^${escapeRegExp(policy.versionPrefix)}\\.(\\d{8})\\.([1-9]\\d*)$`,
    'u',
  );
  const match = pattern.exec(version);
  if (!match) {
    throw new Error(`Trial version must match ${policy.versionPrefix}.YYYYMMDD.<global-sequence>.`);
  }

  const date = match[1];
  const year = Number.parseInt(date.slice(0, 4), 10);
  const month = Number.parseInt(date.slice(4, 6), 10);
  const day = Number.parseInt(date.slice(6, 8), 10);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  const normalizedDate = [
    String(parsedDate.getUTCFullYear()).padStart(4, '0'),
    String(parsedDate.getUTCMonth() + 1).padStart(2, '0'),
    String(parsedDate.getUTCDate()).padStart(2, '0'),
  ].join('');
  if (normalizedDate !== date) {
    throw new Error(`Trial version ${version} contains an invalid calendar date.`);
  }

  const sequence = Number.parseInt(match[2], 10);
  if (!Number.isSafeInteger(sequence)) {
    throw new Error(`Trial version ${version} contains an unsafe global sequence.`);
  }

  return { date, sequence, version };
}

export function validateTrialHistory(history, policy = loadTrialPolicy()) {
  requireRecord(history, 'Trial history');
  validateTrialPolicy(policy);
  if (history.schemaVersion !== 1) throw new Error('Trial history schemaVersion must be 1.');
  const sequenceRange = requireRecord(history.sequenceRange, 'Trial history sequenceRange');
  if (sequenceRange.from !== 74 || sequenceRange.to !== policy.lastSequence) {
    throw new Error(
      `Trial history must cover the bootstrap sequence range .74-.${policy.lastSequence}.`,
    );
  }
  if (!Array.isArray(history.entries)) throw new Error('Trial history entries must be an array.');

  const expectedSequences = Array.from(
    { length: sequenceRange.to - sequenceRange.from + 1 },
    (_, index) => sequenceRange.from + index,
  );
  const actualSequences = history.entries.map(({ sequence }) => sequence);
  if (
    actualSequences.length !== expectedSequences.length ||
    actualSequences.some((sequence, index) => sequence !== expectedSequences[index])
  ) {
    throw new Error(
      `Trial history entries must contain every sequence from .${sequenceRange.from} through .${sequenceRange.to} exactly once and in order.`,
    );
  }

  const exactVersionLocations = new Map();
  for (const entry of history.entries) {
    requireRecord(entry, `Trial history .${entry?.sequence ?? 'unknown'}`);
    if (!Number.isSafeInteger(entry.sequence)) {
      throw new Error('Every trial history entry must have an integer sequence.');
    }
    if (typeof entry.collision !== 'boolean') {
      throw new Error(`Trial history .${entry.sequence} collision must be boolean.`);
    }
    if (!Array.isArray(entry.events) || entry.events.length === 0) {
      throw new Error(`Trial history .${entry.sequence} must contain at least one event.`);
    }

    const commits = new Set();
    for (const [eventIndex, event] of entry.events.entries()) {
      requireRecord(event, `Trial history .${entry.sequence} event ${eventIndex}`);
      requireText(event.label, `Trial history .${entry.sequence} event ${eventIndex} label`);
      const commit = requireFullCommit(
        event.commit,
        `Trial history .${entry.sequence} event ${eventIndex} commit`,
      );
      commits.add(commit);
      if (!PLATFORM_ACTIONS.has(event.platformAction)) {
        throw new Error(
          `Trial history .${entry.sequence} event ${eventIndex} has an unsupported platformAction.`,
        );
      }
      requireText(event.evidence, `Trial history .${entry.sequence} event ${eventIndex} evidence`);

      if (event.version === null) {
        if (event.versionEvidence !== 'sequence-only') {
          throw new Error(
            `Trial history .${entry.sequence} without an exact version must use sequence-only evidence.`,
          );
        }
      } else {
        if (event.versionEvidence !== 'exact') {
          throw new Error(
            `Trial history .${entry.sequence} exact version must use exact evidence.`,
          );
        }
        const parsedVersion = parseTrialVersion(event.version, policy);
        if (parsedVersion.sequence !== entry.sequence) {
          throw new Error(
            `Trial history version ${event.version} does not belong to sequence .${entry.sequence}.`,
          );
        }
        const previousSequence = exactVersionLocations.get(event.version);
        if (previousSequence !== undefined && previousSequence !== entry.sequence) {
          throw new Error(`Trial history version ${event.version} appears in multiple sequences.`);
        }
        exactVersionLocations.set(event.version, entry.sequence);
      }
    }

    const hasSequenceCollision = commits.size > 1;
    if (entry.collision !== hasSequenceCollision) {
      throw new Error(
        `Trial history collision marker for .${entry.sequence} must be ${hasSequenceCollision}.`,
      );
    }
  }

  return history;
}

export function validateTrialConfiguration(history, policy) {
  validateTrialPolicy(policy);
  validateTrialHistory(history, policy);
  return { history, policy };
}

async function defaultRunGit(args, options = {}) {
  const acceptedExitCodes = options.acceptedExitCodes ?? [0];
  try {
    const { stderr, stdout } = await execFileAsync('git', args, {
      cwd: options.cwd ?? REPOSITORY_ROOT,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    });
    return { code: 0, stderr, stdout };
  } catch (error) {
    const code = typeof error?.code === 'number' ? error.code : null;
    if (code !== null && acceptedExitCodes.includes(code)) {
      return {
        code,
        stderr: typeof error.stderr === 'string' ? error.stderr : '',
        stdout: typeof error.stdout === 'string' ? error.stdout : '',
      };
    }
    throw new Error(
      `Git ${args[0] ?? 'command'} failed${code === null ? '' : ` with exit code ${code}`}.`,
      { cause: error },
    );
  }
}

async function gitText(runGit, repositoryRoot, args, acceptedExitCodes) {
  const result = await runGit(args, {
    acceptedExitCodes,
    cwd: repositoryRoot,
  });
  return { ...result, stdout: result.stdout.trim() };
}

async function commitExists(runGit, repositoryRoot, commit) {
  const result = await gitText(
    runGit,
    repositoryRoot,
    ['cat-file', '-e', `${commit}^{commit}`],
    [0, 1, 128],
  );
  return result.code === 0;
}

async function isAncestor(runGit, repositoryRoot, ancestor, descendant) {
  const result = await gitText(
    runGit,
    repositoryRoot,
    ['merge-base', '--is-ancestor', ancestor, descendant],
    [0, 1],
  );
  return result.code === 0;
}

export async function evaluateEquivalentProof(runGit, repositoryRoot, checkpoint) {
  const proof = checkpoint.equivalentProof;
  if (proof === undefined) return { equivalent: false, files: [] };

  const files = [];
  let equivalent = true;
  for (const file of proof.files) {
    const result = await gitText(
      runGit,
      repositoryRoot,
      ['rev-parse', `HEAD:${file.path}`],
      [0, 128],
    );
    const actual = result.code === 0 ? result.stdout.toLowerCase() : null;
    const matches = actual === file.blob;
    if (!matches) equivalent = false;
    files.push({ actual, blob: file.blob, matches, path: file.path });
  }
  return { equivalent, files, strategy: proof.strategy };
}

function remoteTagRef(version, policy) {
  return `refs/tags/${policy.tagPrefix}${version}`;
}

function parseRemoteTrialTags(output, policy) {
  if (output.trim() === '') return [];
  const prefix = `refs/tags/${policy.tagPrefix}`;
  const sequenceVersions = new Map();
  const tags = output
    .trim()
    .split(/\r?\n/gu)
    .map((line) => {
      const [commit, ref, ...extra] = line.trim().split(/\s+/u);
      if (extra.length > 0 || !FULL_COMMIT_PATTERN.test(commit ?? '') || !ref?.startsWith(prefix)) {
        throw new Error('Remote trial tag listing contains an invalid entry.');
      }
      const version = ref.slice(prefix.length);
      const parsed = parseTrialVersion(version, policy);
      const previousVersion = sequenceVersions.get(parsed.sequence);
      if (previousVersion !== undefined && previousVersion !== version) {
        throw new Error(
          `Remote trial sequence .${parsed.sequence} is occupied by more than one version.`,
        );
      }
      sequenceVersions.set(parsed.sequence, version);
      return { commit, ref, ...parsed };
    });
  tags.sort(
    (left, right) => left.sequence - right.sequence || left.version.localeCompare(right.version),
  );
  return tags;
}

async function listRemoteTrialTags(runGit, repositoryRoot, policy, exactVersion) {
  const pattern = exactVersion
    ? remoteTagRef(exactVersion, policy)
    : `refs/tags/${policy.tagPrefix}*`;
  const result = await gitText(
    runGit,
    repositoryRoot,
    ['ls-remote', '--refs', '--tags', policy.remote, pattern],
    [0],
  );
  return parseRemoteTrialTags(result.stdout, policy);
}

function formatTrialDate(now) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error('Trial allocation requires a valid date.');
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
    })
      .formatToParts(now)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}${parts.month}${parts.day}`;
}

export async function allocateNextTrialVersion(
  { now = new Date(), repositoryRoot = REPOSITORY_ROOT } = {},
  options = {},
) {
  const runGit = options.runGit ?? defaultRunGit;
  const policy = options.policy ?? loadTrialPolicy();
  const history = options.history ?? loadTrialHistory();
  validateTrialConfiguration(history, policy);
  const tags = await listRemoteTrialTags(runGit, path.resolve(repositoryRoot), policy);
  const highestRemoteSequence = tags.reduce((highest, tag) => Math.max(highest, tag.sequence), 0);
  const allocations = await (options.readLocalTrialAllocations ?? readLocalTrialAllocations)(
    repositoryRoot,
    options,
  );
  const highestLocalSequence = allocations.reduce(
    (highest, record) => Math.max(highest, parseTrialVersion(record.version, policy).sequence),
    0,
  );
  const nextSequence =
    Math.max(policy.lastSequence, highestRemoteSequence, highestLocalSequence) + 1;
  return `${policy.versionPrefix}.${formatTrialDate(now)}.${nextSequence}`;
}

async function fetchRemoteMain(runGit, repositoryRoot, policy) {
  const remoteMainRef = `refs/remotes/${policy.remote}/${policy.mainBranch}`;
  await gitText(
    runGit,
    repositoryRoot,
    ['fetch', '--no-tags', policy.remote, `+refs/heads/${policy.mainBranch}:${remoteMainRef}`],
    [0],
  );
  const result = await gitText(
    runGit,
    repositoryRoot,
    ['rev-parse', `${remoteMainRef}^{commit}`],
    [0],
  );
  return requireFullCommit(result.stdout, `${policy.remote}/${policy.mainBranch}`);
}

async function verifyLightweightRemoteTag(runGit, repositoryRoot, tag, policy) {
  await gitText(runGit, repositoryRoot, ['fetch', '--no-tags', policy.remote, tag.ref], [0]);
  const type = await gitText(runGit, repositoryRoot, ['cat-file', '-t', tag.commit], [0]);
  if (type.stdout !== 'commit') {
    throw new Error(`Remote trial tag ${tag.version} must be a lightweight commit tag.`);
  }
  return tag;
}

export function assertTrialCandidateFacts(facts, policy = loadTrialPolicy()) {
  validateTrialPolicy(policy);
  requireRecord(facts, 'Trial candidate facts');
  const head = requireFullCommit(facts.head, 'Trial candidate HEAD');
  const shortHead = head.slice(0, 7);
  if (facts.dirty !== false) {
    throw new Error('Trial upload requires a clean working tree.');
  }
  if (facts.profile !== 'production') {
    throw new Error('Trial upload requires the production profile.');
  }
  const description = requireText(facts.description, 'Trial description');
  if (!description.toLowerCase().includes(shortHead)) {
    throw new Error(`Trial description must contain the short HEAD ${shortHead}.`);
  }
  const parsedVersion = parseTrialVersion(facts.version, policy);

  const existingVersionCommit =
    facts.existingVersionCommit === null || facts.existingVersionCommit === undefined
      ? null
      : requireFullCommit(facts.existingVersionCommit, 'Existing trial version commit');
  if (existingVersionCommit !== null && existingVersionCommit !== head) {
    throw new Error(
      `Trial version ${parsedVersion.version} is already reserved by a different commit ${existingVersionCommit.slice(0, 7)}.`,
    );
  }

  const originMain = requireRecord(facts.originMain, 'origin/main ancestry result');
  const originMainCommit = requireFullCommit(originMain.commit, 'origin/main commit');
  if (originMain.isAncestor !== true) {
    throw new Error(
      `Fresh ${policy.remote}/${policy.mainBranch} ${originMainCommit.slice(0, 7)} must be an ancestor of trial HEAD.`,
    );
  }

  let latestTrial = null;
  if (facts.latestTrial !== null && facts.latestTrial !== undefined) {
    latestTrial = requireRecord(facts.latestTrial, 'Latest cumulative trial');
    requireFullCommit(latestTrial.commit, 'Latest cumulative trial commit');
    parseTrialVersion(latestTrial.version, policy);
    if (!Number.isSafeInteger(latestTrial.sequence)) {
      throw new Error('Latest cumulative trial sequence must be an integer.');
    }
    if (
      latestTrial.trackedHistory !== undefined &&
      typeof latestTrial.trackedHistory !== 'boolean'
    ) {
      throw new Error('Latest cumulative trial trackedHistory must be boolean.');
    }
  }

  if (!Array.isArray(facts.requiredCheckpoints)) {
    throw new Error('Required checkpoint ancestry results are missing.');
  }
  const ancestryByCommit = new Map(
    facts.requiredCheckpoints.map((checkpoint) => [checkpoint.commit?.toLowerCase(), checkpoint]),
  );
  const requiredFeatureCoverage = policy.requiredCheckpoints.every((checkpoint) => {
    const ancestry = ancestryByCommit.get(checkpoint.commit.toLowerCase());
    return (
      ancestry?.isAncestor === true ||
      (ancestry?.equivalent === true && checkpoint.equivalentProof !== undefined)
    );
  });
  if (
    latestTrial !== null &&
    latestTrial.isAncestor !== true &&
    !(latestTrial.trackedHistory === true && requiredFeatureCoverage)
  ) {
    throw new Error(
      `Latest cumulative trial ${latestTrial.version} must be an ancestor of trial HEAD unless it is a tracked observation and every required feature has a verified canonical equivalence proof.`,
    );
  }
  for (const checkpoint of policy.requiredCheckpoints) {
    const commit = checkpoint.commit.toLowerCase();
    const ancestry = ancestryByCommit.get(commit);
    const equivalent = ancestry?.equivalent === true && checkpoint.equivalentProof !== undefined;
    if (ancestry?.isAncestor !== true && !equivalent) {
      throw new Error(
        `Required checkpoint ${commit.slice(0, 7)} must be an ancestor of trial HEAD or match its canonical equivalence proof.`,
      );
    }
  }

  const latestSequence = Math.max(policy.lastSequence, latestTrial?.sequence ?? 0);
  const reservation = existingVersionCommit === head ? 'idempotent' : 'new';
  if (reservation === 'idempotent') {
    if (latestTrial === null || latestTrial.version !== parsedVersion.version) {
      throw new Error('Only the latest cumulative trial version may be retried idempotently.');
    }
  } else if (parsedVersion.sequence <= latestSequence) {
    throw new Error(
      `New trial sequence .${parsedVersion.sequence} must be greater than ${latestSequence}.`,
    );
  }

  return {
    ...parsedVersion,
    description,
    head,
    latestSequence,
    profile: facts.profile,
    reservation,
    shortHead,
  };
}

export async function inspectTrialCandidate(
  { description, profile, repositoryRoot = REPOSITORY_ROOT, version },
  options = {},
) {
  const runGit = options.runGit ?? defaultRunGit;
  const policy = options.policy ?? loadTrialPolicy();
  const history = options.history ?? loadTrialHistory();
  validateTrialConfiguration(history, policy);

  const resolvedRepositoryRoot = path.resolve(repositoryRoot);
  const originMainCommit = await fetchRemoteMain(runGit, resolvedRepositoryRoot, policy);
  const headResult = await gitText(
    runGit,
    resolvedRepositoryRoot,
    ['rev-parse', 'HEAD^{commit}'],
    [0],
  );
  const head = requireFullCommit(headResult.stdout, 'Trial candidate HEAD');
  const status = await gitText(
    runGit,
    resolvedRepositoryRoot,
    ['status', '--porcelain', '--untracked-files=normal'],
    [0],
  );
  const tags = await listRemoteTrialTags(runGit, resolvedRepositoryRoot, policy);
  const latestTag = tags.at(-1) ?? null;
  if (latestTag !== null) {
    await verifyLightweightRemoteTag(runGit, resolvedRepositoryRoot, latestTag, policy);
  }
  const exactTag = tags.find((tag) => tag.version === version) ?? null;

  if (!(await commitExists(runGit, resolvedRepositoryRoot, originMainCommit))) {
    throw new Error(`Fresh ${policy.remote}/${policy.mainBranch} commit is unavailable locally.`);
  }
  const originMainIsAncestor = await isAncestor(
    runGit,
    resolvedRepositoryRoot,
    originMainCommit,
    head,
  );

  const requiredCheckpoints = [];
  for (const checkpoint of policy.requiredCheckpoints) {
    if (!(await commitExists(runGit, resolvedRepositoryRoot, checkpoint.commit))) {
      throw new Error(
        `Required checkpoint ${checkpoint.commit.slice(0, 7)} is unavailable in this repository.`,
      );
    }
    const isAncestorResult = await isAncestor(
      runGit,
      resolvedRepositoryRoot,
      checkpoint.commit,
      head,
    );
    const equivalence = await evaluateEquivalentProof(runGit, resolvedRepositoryRoot, checkpoint);
    requiredCheckpoints.push({
      commit: checkpoint.commit,
      equivalence,
      equivalent: equivalence.equivalent,
      isAncestor: isAncestorResult,
    });
  }

  const latestHistoryEvent =
    latestTag === null
      ? null
      : (history.entries
          .flatMap((entry) => entry.events)
          .find(
            (event) =>
              event.version === latestTag.version &&
              event.commit.toLowerCase() === latestTag.commit,
          ) ?? null);

  const latestTrial =
    latestTag === null
      ? null
      : {
          ...latestTag,
          isAncestor: await isAncestor(runGit, resolvedRepositoryRoot, latestTag.commit, head),
          trackedHistory: latestHistoryEvent !== null,
        };
  const validated = assertTrialCandidateFacts(
    {
      description,
      dirty: status.stdout !== '',
      existingVersionCommit: exactTag?.commit ?? null,
      head,
      latestTrial,
      originMain: { commit: originMainCommit, isAncestor: originMainIsAncestor },
      profile,
      requiredCheckpoints,
      version,
    },
    policy,
  );

  return {
    ...validated,
    repositoryRoot: resolvedRepositoryRoot,
    tagRef: remoteTagRef(validated.version, policy),
  };
}

export async function confirmTrialCandidate(candidate, options = {}) {
  requireRecord(candidate, 'Inspected trial candidate');
  const confirmed = await inspectTrialCandidate(
    {
      description: candidate.description,
      profile: candidate.profile,
      repositoryRoot: candidate.repositoryRoot,
      version: candidate.version,
    },
    options,
  );
  if (confirmed.head !== candidate.head) {
    throw new Error(
      `Trial HEAD changed after inspection (${candidate.shortHead} -> ${confirmed.shortHead}).`,
    );
  }
  return confirmed;
}

async function assertLocalReservationState(runGit, repositoryRoot, head) {
  const currentHead = await gitText(runGit, repositoryRoot, ['rev-parse', 'HEAD^{commit}'], [0]);
  if (currentHead.stdout.toLowerCase() !== head) {
    throw new Error('Trial HEAD changed before remote version reservation.');
  }
  const status = await gitText(
    runGit,
    repositoryRoot,
    ['status', '--porcelain', '--untracked-files=normal'],
    [0],
  );
  if (status.stdout !== '') {
    throw new Error('Trial working tree became dirty before remote version reservation.');
  }
}

function resolveExistingReservation(tags, head, version) {
  const existing = tags[0] ?? null;
  if (existing === null) return null;
  if (existing.commit !== head) {
    throw new Error(
      `Trial version ${version} is already reserved by a different commit ${existing.commit.slice(0, 7)}.`,
    );
  }
  return {
    head,
    ref: existing.ref,
    reservation: 'idempotent',
    version,
  };
}

export async function reserveTrialVersion(
  { head: candidateHead, repositoryRoot = REPOSITORY_ROOT, version },
  options = {},
) {
  const runGit = options.runGit ?? defaultRunGit;
  const policy = options.policy ?? loadTrialPolicy();
  validateTrialPolicy(policy);
  parseTrialVersion(version, policy);
  const head = requireFullCommit(candidateHead, 'Trial reservation HEAD');
  const resolvedRepositoryRoot = path.resolve(repositoryRoot);
  await assertLocalReservationState(runGit, resolvedRepositoryRoot, head);

  const before = await listRemoteTrialTags(runGit, resolvedRepositoryRoot, policy, version);
  const existing = resolveExistingReservation(before, head, version);
  if (existing !== null) return existing;

  const ref = remoteTagRef(version, policy);
  let pushError = null;
  try {
    await gitText(
      runGit,
      resolvedRepositoryRoot,
      ['push', '--porcelain', policy.remote, `${head}:${ref}`],
      [0],
    );
  } catch (error) {
    pushError = error;
  }

  const after = await listRemoteTrialTags(runGit, resolvedRepositoryRoot, policy, version);
  const reserved = resolveExistingReservation(after, head, version);
  if (reserved !== null) {
    return {
      ...reserved,
      reservation: pushError === null ? 'created' : 'idempotent',
    };
  }
  throw new Error(`Unable to reserve trial version ${version}; the remote tag was not created.`, {
    cause: pushError,
  });
}

export function assertBuildProfileMatchesCandidate(buildProfile, candidate) {
  requireRecord(buildProfile, 'build-profile.json');
  requireRecord(candidate, 'Trial candidate');
  const expected = {
    buildCommit: candidate.shortHead,
    buildDescription: candidate.description,
    buildDirty: false,
    buildVersion: candidate.version,
    profile: 'production',
    schemaVersion: 1,
  };
  const mismatches = Object.entries(expected)
    .filter(([field, value]) => buildProfile[field] !== value)
    .map(([field]) => field);
  if (
    typeof buildProfile.buildTime !== 'string' ||
    !Number.isFinite(Date.parse(buildProfile.buildTime))
  ) {
    mismatches.push('buildTime');
  }
  if (mismatches.length > 0) {
    throw new Error(
      `build-profile.json does not exactly match the inspected trial candidate: ${mismatches.join(', ')}.`,
    );
  }
  return buildProfile;
}

export async function readBuildProfile(outputDirectory) {
  const buildProfilePath = path.join(path.resolve(outputDirectory), 'build-profile.json');
  try {
    return JSON.parse(await readFile(buildProfilePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read build-profile.json from ${outputDirectory}.`, { cause: error });
  }
}

async function resolveDefaultReceiptContext(runGit, repositoryRoot) {
  const commonDirectory = await gitText(
    runGit,
    repositoryRoot,
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    [0],
  );
  const resolvedCommonDirectory = path.resolve(repositoryRoot, commonDirectory.stdout);
  if (path.basename(resolvedCommonDirectory) !== '.git') {
    throw new Error('Unable to resolve the main repository root for the trial receipt.');
  }
  const storageRoot = path.dirname(resolvedCommonDirectory);
  return {
    receiptRoot: path.join(storageRoot, 'runtime', 'audit', 'miniprogram-trials'),
    storageRoot,
  };
}

async function defaultVerifyIgnored(receiptPath, { runGit, storageRoot }) {
  const relativePath = path.relative(storageRoot, receiptPath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return false;
  const result = await gitText(
    runGit,
    storageRoot,
    ['check-ignore', '--quiet', '--', relativePath],
    [0, 1],
  );
  return result.code === 0;
}

async function localTrialContext(repositoryRoot, options) {
  const runGit = options.runGit ?? defaultRunGit;
  const context =
    options.receiptRoot === undefined
      ? await resolveDefaultReceiptContext(runGit, repositoryRoot)
      : {
          receiptRoot: path.resolve(options.receiptRoot),
          storageRoot: path.resolve(repositoryRoot),
        };
  const allowed = await (options.verifyIgnored ?? defaultVerifyIgnored)(context.receiptRoot, {
    runGit,
    storageRoot: context.storageRoot,
  });
  if (!allowed) throw new Error('Trial allocation/manifest directory must be ignored.');
  assertNoPathLinks(context.storageRoot, context.receiptRoot);
  return context;
}

export async function readLocalTrialAllocations(repositoryRoot = REPOSITORY_ROOT, options = {}) {
  const context = await localTrialContext(repositoryRoot, options);
  let names;
  try {
    names = await readdir(context.receiptRoot);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const records = [];
  for (const name of names.filter((value) => value.endsWith('.allocation.json'))) {
    const file = path.join(context.receiptRoot, name);
    assertNoPathLinks(context.storageRoot, file);
    const record = JSON.parse(await readFile(file, 'utf8'));
    if (record.schemaVersion !== 1 || record.profile !== 'production')
      throw new Error('Malformed trial allocation record.');
    requireFullCommit(record.commit, 'Trial allocation commit');
    parseTrialVersion(record.version, options.policy ?? loadTrialPolicy());
    if (name !== `${record.version}.allocation.json`)
      throw new Error('Trial allocation filename mismatch.');
    records.push(record);
  }
  return records;
}

async function immutableTrialRecord(file, record, fields) {
  try {
    await writeFile(file, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const existing = JSON.parse(await readFile(file, 'utf8'));
    if (fields.some((field) => existing[field] !== record[field]))
      throw new Error('Immutable trial allocation/manifest tuple conflict.');
    return existing;
  }
  return record;
}

export async function recordTrialAllocation(candidate, options = {}) {
  const version = parseTrialVersion(candidate.version, options.policy ?? loadTrialPolicy()).version;
  const commit = requireFullCommit(candidate.head, 'Trial allocation commit');
  if (candidate.profile !== 'production') throw new Error('Trial allocation requires production.');
  const context = await localTrialContext(candidate.repositoryRoot ?? REPOSITORY_ROOT, options);
  await mkdir(context.receiptRoot, { recursive: true });
  const file = path.join(context.receiptRoot, `${version}.allocation.json`);
  assertNoPathLinks(context.storageRoot, file);
  return immutableTrialRecord(
    file,
    {
      schemaVersion: 1,
      version,
      commit,
      profile: 'production',
      description: candidate.description,
      allocatedAt: new Date().toISOString(),
    },
    ['schemaVersion', 'version', 'commit', 'profile', 'description'],
  );
}

export async function bindTrialManifest({ candidate, manifestDigest, buildTime }, options = {}) {
  const allocation = await recordTrialAllocation(candidate, options);
  if (
    !MANIFEST_DIGEST_PATTERN.test(manifestDigest ?? '') ||
    !Number.isFinite(Date.parse(buildTime))
  )
    throw new Error('Invalid frozen trial manifest identity.');
  const context = await localTrialContext(candidate.repositoryRoot ?? REPOSITORY_ROOT, options);
  const file = path.join(context.receiptRoot, `${allocation.version}.manifest.json`);
  assertNoPathLinks(context.storageRoot, file);
  if (candidate.reservation === 'idempotent') {
    try {
      await readFile(file, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT')
        throw new Error('Cannot retry a reserved version without immutable manifest evidence.');
      throw error;
    }
  }
  await immutableTrialRecord(file, { ...allocation, manifestDigest, buildTime }, [
    'schemaVersion',
    'version',
    'commit',
    'profile',
    'description',
    'manifestDigest',
    'buildTime',
  ]);
  return file;
}

async function releaseTrialUploadLock(lock, ownerPath, nonce, runId, operationError) {
  try {
    const owner = JSON.parse(await readFile(ownerPath, 'utf8'));
    if (owner.nonce !== nonce || owner.runId !== runId)
      throw new Error('Upload lock ownership changed; lock retained.');
    await unlink(ownerPath);
    await rmdir(lock);
  } catch (cleanupError) {
    if (operationError)
      throw new AggregateError(
        [operationError, cleanupError],
        'Upload operation and lock cleanup failed; inspect retained evidence.',
      );
    throw cleanupError;
  }
}

export async function withTrialUploadLock(
  { repositoryRoot = REPOSITORY_ROOT, runId },
  operation,
  options = {},
) {
  requireText(runId, 'Upload RUN_ID');
  const context = await localTrialContext(repositoryRoot, options);
  const lock = path.join(context.storageRoot, 'runtime/codex/locks/miniprogram-upload.lock');
  assertNoPathLinks(context.storageRoot, lock);
  const runGit = options.runGit ?? defaultRunGit;
  if (
    !(await (options.verifyIgnored ?? defaultVerifyIgnored)(lock, {
      runGit,
      storageRoot: context.storageRoot,
    }))
  )
    throw new Error('Trial upload lock path must be ignored.');
  await mkdir(path.dirname(lock), { recursive: true });
  try {
    await mkdir(lock);
  } catch (error) {
    if (error.code === 'EEXIST')
      throw new Error('UPLOAD_VERSION_ALLOCATION_BLOCKED: another upload operation owns the lock.');
    throw error;
  }
  const nonce = randomUUID();
  const ownerPath = path.join(lock, 'owner.json');
  let operationError;
  try {
    await writeFile(
      ownerPath,
      JSON.stringify({
        schemaVersion: 1,
        nonce,
        runId,
        pid: process.pid,
        acquiredAt: new Date().toISOString(),
      }),
      { flag: 'wx' },
    );
    return await operation();
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    await releaseTrialUploadLock(lock, ownerPath, nonce, runId, operationError);
  }
}

export async function writeTrialReceipt(payload, options = {}) {
  requireRecord(payload, 'Trial upload receipt payload');
  const candidate = requireRecord(payload.candidate, 'Trial upload receipt candidate');
  const policy = options.policy ?? loadTrialPolicy();
  validateTrialPolicy(policy);
  const version = parseTrialVersion(candidate.version, policy).version;
  const commit = requireFullCommit(candidate.head, 'Trial upload receipt commit');
  const description = requireText(candidate.description, 'Trial upload receipt description');
  if (candidate.profile !== 'production') {
    throw new Error('Trial upload receipt requires the production profile.');
  }
  if (!MANIFEST_DIGEST_PATTERN.test(payload.manifestDigest ?? '')) {
    throw new Error('Trial upload receipt manifestDigest must be a SHA-256 digest.');
  }
  if (!['created', 'idempotent'].includes(payload.reservation)) {
    throw new Error('Trial upload receipt reservation must be created or idempotent.');
  }
  for (const field of ['buildTime', 'uploadedAt']) {
    if (typeof payload[field] !== 'string' || !Number.isFinite(Date.parse(payload[field]))) {
      throw new Error(`Trial upload receipt ${field} must be an ISO timestamp.`);
    }
  }

  const runGit = options.runGit ?? defaultRunGit;
  const repositoryRoot = path.resolve(candidate.repositoryRoot ?? REPOSITORY_ROOT);
  const defaultContext =
    options.receiptRoot === undefined
      ? await resolveDefaultReceiptContext(runGit, repositoryRoot)
      : { receiptRoot: path.resolve(options.receiptRoot), storageRoot: repositoryRoot };
  const receiptRoot = defaultContext.receiptRoot;
  const receiptPath = path.join(receiptRoot, `${version}.json`);
  const verifyIgnored = options.verifyIgnored ?? defaultVerifyIgnored;
  const ignored = await verifyIgnored(receiptPath, {
    runGit,
    storageRoot: defaultContext.storageRoot,
  });
  if (ignored !== true) {
    throw new Error(`Trial upload receipt path is not ignored by Git: ${receiptPath}.`);
  }

  const receipt = {
    buildTime: payload.buildTime,
    commit,
    description,
    manifestDigest: payload.manifestDigest,
    profile: 'production',
    reservation: payload.reservation,
    schemaVersion: 1,
    tag: `${policy.tagPrefix}${version}`,
    uploadedAt: payload.uploadedAt,
    version,
  };
  await mkdir(receiptRoot, { recursive: true });
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return receiptPath;
}

export async function auditTrialConfiguration(options = {}) {
  const runGit = options.runGit ?? defaultRunGit;
  const repositoryRoot = path.resolve(options.repositoryRoot ?? REPOSITORY_ROOT);
  const policy = options.policy ?? loadTrialPolicy();
  const history = options.history ?? loadTrialHistory();
  validateTrialConfiguration(history, policy);
  for (const checkpoint of policy.requiredCheckpoints) {
    if (!(await commitExists(runGit, repositoryRoot, checkpoint.commit))) {
      throw new Error(`Required checkpoint ${checkpoint.commit} does not exist locally.`);
    }
  }
  return {
    firstSequence: history.sequenceRange.from,
    lastSequence: policy.lastSequence,
    requiredCheckpoints: policy.requiredCheckpoints.map(({ commit }) => commit),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(THIS_FILE)) {
  try {
    if ((process.argv[2] ?? 'audit') !== 'audit') {
      throw new Error('Expected trial-lineage command "audit".');
    }
    const result = await auditTrialConfiguration();
    console.log(
      `[trial-lineage] history .${result.firstSequence}-.${result.lastSequence} valid; required-checkpoints=${result.requiredCheckpoints.length}`,
    );
  } catch (error) {
    console.error(
      `[trial-lineage] failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
