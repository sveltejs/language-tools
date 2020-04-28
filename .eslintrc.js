module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    rules: {
        semi: ['error', 'always'],
        'keyword-spacing': ['error', { before: true, after: true }],
        'space-before-blocks': ['error', 'always'],
        'arrow-spacing': 'error',
        'max-len': [
            'error',
            { code: 100, ignoreComments: true, ignoreStrings: true }
        ],

        'no-const-assign': 'error',
        'no-class-assign': 'error',
        'no-this-before-super': 'error',
        'no-unreachable': 'error',
        'prefer-arrow-callback': 'error',
        'prefer-const': ['error', { destructuring: 'all' }],
        'one-var': ['error', 'never'],
        'no-inner-declarations': 'off',

        '@typescript-eslint/no-use-before-define': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': [
            'error',
            {
                argsIgnorePattern: '^_'
            }
        ],
        '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'angle-bracket' }],
        // might wanted to migrate to module only
        '@typescript-eslint/no-namespace': 'off'
    }
};
