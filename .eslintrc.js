module.exports = {
    root: true,
    extends: '@sveltejs',
    plugins: ['import'],
    env: {
        node: true
    },
    rules: {
        // enabling these rules makes the linting extremely slow.
        // (it's conceivable some subset of them could be enabled without impacting speed)
        // see https://github.com/typescript-eslint/typescript-eslint/blob/master/docs/getting-started/linting/FAQ.md#eslint-plugin-import
        'import/named': 'off',
        'import/namespace': 'off',
        'import/default': 'off',
        'import/no-named-as-default-member': 'off',
        'import/no-named-as-default': 'off',
        'import/no-cycle': 'off',
        'import/no-unused-modules': 'off',
        'import/no-deprecated': 'off',
        // project-specific settings
        'max-len': 'off', // handled by prettier
        'no-trailing-spaces': 'error',
        'one-var': ['error', 'never'],
        '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
        '@typescript-eslint/no-namespace': 'warn',
        '@typescript-eslint/no-non-null-assertion': 'warn',
        // exclude workspace dependencies
        'import/no-unresolved': [2, { ignore: ['svelte-language-server'] }]
    }
};
