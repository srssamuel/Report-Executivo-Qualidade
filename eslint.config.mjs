import nextConfig from 'eslint-config-next'
import coreWebVitals from 'eslint-config-next/core-web-vitals'
import tsConfig from 'eslint-config-next/typescript'

const eslintConfig = [
  ...nextConfig,
  ...coreWebVitals,
  ...tsConfig,
  {
    ignores: ['.next/**', 'node_modules/**', 'docs/**'],
  },
  {
    rules: {
      // Allow _-prefixed vars as intentionally unused
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
]

export default eslintConfig
