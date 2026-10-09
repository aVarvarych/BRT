import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const LAYERS = ['domain', 'application', 'infrastructure', 'presentation', 'main'];

export default defineConfig(
  { ignores: ['node_modules', 'dist', 'coverage'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.json' } },
      'boundaries/elements': [
        ...LAYERS.map((type) => ({ type, pattern: `src/${type}` })),
        { type: 'tests', pattern: 'tests' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkAllOrigins: true,
          policies: [
            {
              from: { element: { type: 'domain' } },
              allow: { to: { element: { type: 'domain' } } },
            },
            {
              from: { element: { type: 'application' } },
              allow: { to: { element: { types: { anyOf: ['domain', 'application'] } } } },
            },
            {
              from: { element: { type: 'infrastructure' } },
              allow: { to: { element: { types: { anyOf: ['domain', 'application', 'infrastructure'] } } } },
            },
            {
              from: { element: { type: 'presentation' } },
              allow: { to: { element: { types: { anyOf: ['domain', 'application', 'presentation'] } } } },
            },
            {
              from: { element: { types: { anyOf: ['main', 'tests'] } } },
              allow: { to: { element: { type: '*' } } },
            },
            {
              from: { element: { types: { anyOf: ['infrastructure', 'presentation', 'main', 'tests'] } } },
              allow: { to: { module: { origin: ['external', 'core'] } } },
            },
          ],
        },
      ],
    },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
  prettier,
);
