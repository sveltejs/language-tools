import fs from 'fs';
import { svelte2tsx } from '../src/svelte2tsx/index';
import { VERSION } from 'svelte/compiler';

const content = fs.readFileSync(`${__dirname}/index.svelte`, 'utf-8');

console.log(svelte2tsx(content, {version: VERSION}).code);
/**
 * To enable the REPL, simply run the "dev" package script.
 *
 * The "/repl/index.svelte" file will be converted to tsx
 * at "/repl/output/" using the modified source code on change.
 *
 * Alternatively you may run this file with a debugger attached,
 * to do so, hit "Ctrl+Shift+D" and select "svelte2tsx" in the dropdown.
 */
