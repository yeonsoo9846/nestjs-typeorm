// @ts-check
import { config } from './base.js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...config,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  },
  {
    rules: {
      // NestJS-specific rules (extending base)
      '@typescript-eslint/no-floating-promises': 'error',
      'class-methods-use-this': 'off',
      'no-useless-constructor': 'off',
      '@typescript-eslint/no-useless-constructor': 'error',
      'no-empty-function': 'off',
      '@typescript-eslint/no-empty-function': 'error',
    },
  },
);