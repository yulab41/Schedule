#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const allowedRootKeys = new Set([
  'appid',
  'compileType',
  'libVersion',
  'miniprogramRoot',
  'projectname',
  'setting',
]);

const allowedSettingKeys = new Set([
  'compileWorklet',
  'es6',
  'minified',
  'minifyWXML',
  'minifyWXSS',
  'postcss',
  'uploadWithSourceMap',
  'urlCheck',
  'useCompilerPlugins',
]);

const requiredRootValues = {
  appid: 'wx56a7a21f974fd9af',
  compileType: 'miniprogram',
  libVersion: '3.16.2',
  miniprogramRoot: './',
  projectname: 'schedule-miniprogram',
};

const requiredTrueSettings = [
  'compileWorklet',
  'es6',
  'minified',
  'minifyWXML',
  'minifyWXSS',
  'postcss',
  'uploadWithSourceMap',
  'urlCheck',
];

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function findProjectConfigIssues(config) {
  if (!isRecord(config)) {
    return ['project configuration must be an object'];
  }

  const issues = [];
  for (const key of Object.keys(config)) {
    if (!allowedRootKeys.has(key)) {
      issues.push(`${key} is not allowed in tracked configuration`);
    }
  }

  for (const [key, expected] of Object.entries(requiredRootValues)) {
    if (config[key] !== expected) {
      issues.push(`${key} must equal ${expected}`);
    }
  }

  if (!isRecord(config.setting)) {
    issues.push('setting must be an object');
    return issues;
  }

  for (const key of Object.keys(config.setting)) {
    if (!allowedSettingKeys.has(key)) {
      issues.push(`setting.${key} is not allowed in tracked configuration`);
    }
  }
  for (const key of requiredTrueSettings) {
    if (config.setting[key] !== true) {
      issues.push(`setting.${key} must be true`);
    }
  }
  if (
    !Array.isArray(config.setting.useCompilerPlugins) ||
    config.setting.useCompilerPlugins.length !== 1 ||
    config.setting.useCompilerPlugins[0] !== 'typescript'
  ) {
    issues.push('setting.useCompilerPlugins must contain only typescript');
  }

  return issues;
}

export function auditTrackedProjectConfig() {
  const configUrl = new URL('../apps/miniprogram/project.config.json', import.meta.url);
  const config = JSON.parse(readFileSync(configUrl, 'utf8'));
  return findProjectConfigIssues(config);
}

const invokedUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (invokedUrl === import.meta.url) {
  const issues = auditTrackedProjectConfig();
  if (issues.length > 0) {
    console.error('[miniprogram-config-audit] failed');
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exitCode = 1;
  } else {
    console.log('[miniprogram-config-audit] passed');
  }
}
