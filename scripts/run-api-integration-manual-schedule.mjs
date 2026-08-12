#!/usr/bin/env node
import { runManualScheduleIntegrationTests } from './run-api-integration.mjs';

process.exitCode = runManualScheduleIntegrationTests();
