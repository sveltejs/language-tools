import { IPseudoClassData } from 'vscode-css-languageservice';

export const pseudoClass: IPseudoClassData[] = [
    {
        name: ':global()',
        description: `[svelte] :global modifier

Applying styles to a selector globally`,
        references: [
            {
                name: 'Svelte.dev Reference',
                url: 'https://svelte.dev/docs#style'
            }
        ]
    }
];
