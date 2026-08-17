#!/usr/bin/env node

import { printIssues, readProfileArgument, verifyDeterministicBuild } from './build-tools.mjs';

const profile = readProfileArgument();
const result = await verifyDeterministicBuild(profile);
printIssues('miniprogram-determinism', result.issues);
if (result.issues.length > 0) process.exitCode = 1;
else console.log(`[miniprogram-determinism] passed; manifest ${result.manifestSha256}`);
