const fs = require('fs');

let svelteShims = fs.readFileSync('./svelte-shims.d.ts', { encoding: 'utf-8' });
svelteShims = svelteShims.substr(svelteShims.indexOf('declare class Sv')).replace(/`/g, '\\`');
fs.writeFileSync(
    './src/svelte2tsx/svelteShims.ts',
    `/* eslint-disable */
// Auto-generated, do not change
// prettier-ignore
export const svelteShims = \`${svelteShims}\`;
`
);
