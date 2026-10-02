import { includeIgnoreFile } from 'eslint/config'
import path from 'path'
import { fileURLToPath } from 'url'
import cfg from '@fingerprintjs/eslint-config-dx-team/type-checked'
import tseslint from 'typescript-eslint'
import importPlugin from 'eslint-plugin-import'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const config = [
  includeIgnoreFile(path.resolve(__dirname, '.gitignore')),
  ...cfg,
  importPlugin.flatConfigs.typescript,

  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Numbers and booleans interpolated into template literals are safe to use.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true, allowBoolean: true }],
      // Node's native type-stripping (used for e2e/scripts/mockTests.ts) can only erase an import
      // it can see is type-only from the `import type` keyword, not from cross-file type info.
      '@typescript-eslint/consistent-type-imports': 'error',
      'import/extensions': [
        'error',
        {
          ts: 'always',
        },
      ],
    },
  },

  {
    // Test files rely heavily on mocks and type assertions, where strict
    // type-checked rules add noise without catching real bugs.
    files: ['**/*.test.ts', 'e2e/**', 'proxy/test/**', 'mgmt-lambda/test/**'],
    rules: {
      // Test fixtures assert against plain objects; prototype pollution isn't a concern here.
      'no-prototype-builtins': 'off',
      // Test fixtures build deeply nested mock events by hand; the optional fields are always
      // present by construction, so asserting them non-null is pure noise here.
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/consistent-type-assertions': 'off',
    },
  },

  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
]

export default config
