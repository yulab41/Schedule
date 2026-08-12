#!/usr/bin/env node
import { runTask10IntegrationTests } from './run-api-integration.mjs';

process.exitCode = runTask10IntegrationTests();
