module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['eslint:recommended'],
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  env: {
    node: true,
    jest: true,
    es6: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': 'off',
    'no-unused-vars': 'off',
    'no-constant-condition': 'warn',
    'no-case-declarations': 'off',
  },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', 'test*.js'],
}
