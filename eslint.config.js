export default [
  {
    files: ['**/*.js', '**/*.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        browser: true,
        node: true
      }
    },
    rules: {
      'semi': ['error', 'never'],
      'no-extra-semi': 'error',
      'no-unused-vars': 'error',
      'no-trailing-spaces': 'error',
      'quotes': ['error', 'single'],
      'space-infix-ops': 'error',
      'space-unary-ops': ['error', { 'words': true, 'nonwords': false }],
      'space-before-function-paren': ['error', 'never'],
      'space-in-parens': ['error', 'never'],
      'no-unused-vars': 'error',
      'no-lonely-if': 'error',
      'no-multiple-empty-lines': ['error', { 'max': 1 }],
      'no-return-await': 'error',
      'arrow-spacing': 'error',
      'space-infix-ops': 'error',
      'space-unary-ops': ['error', { 'words': true, 'nonwords': false }],
      'array-bracket-spacing': ['error', 'never'],
      'comma-spacing': ['error', { 'before': false, 'after': true }],
      'object-curly-spacing': ['error', 'always'],
      'key-spacing': ['error', { 'beforeColon': false, 'afterColon': true }],
      'no-multi-spaces': 'error'
    }
  }
]
