#!/usr/bin/env node

import { buildMiniProgram, readProfileArgument } from './build-tools.mjs';

const profile = readProfileArgument();
const result = await buildMiniProgram({ profile });
console.log(`[miniprogram-build] ${profile}: ${result.files.length} files written to dist/`);
