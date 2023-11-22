module.exports = {
  env: {
    browser: true,
    jest: true
  },
  root: true,
  ignorePatterns: ['dist/**/*'],
  extends: ['standard', 'plugin:prettier/recommended'],
  plugins: ['prettier'],
  rules: {
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    camelcase: 'off',
    'import/order': 'error',
    'prettier/prettier': [
      'error',
      {
        tabWidth: 2,
        printWidth: 120,
        singleQuote: true,
        trailingComma: 'none',
        semi: false
      }
    ]
  }
}
