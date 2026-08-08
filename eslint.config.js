import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import vue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'apps/miniprogram/miniprogram_npm/**',
    ],
  },
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    files: ['apps/miniprogram/**/*.ts'],
    languageOptions: {
      globals: {
        App: 'readonly',
        Behavior: 'readonly',
        Component: 'readonly',
        Page: 'readonly',
        getApp: 'readonly',
        getCurrentPages: 'readonly',
        wx: 'readonly',
      },
    },
  },
  eslintConfigPrettier,
);
