import fs from 'fs';
import { svelte2tsx } from '../src/svelte2tsx/index';
import { VERSION } from 'svelte/compiler';

for (const file of fs.readdirSync(__dirname)) {
    // only read if is a file
    if (!fs.lstatSync(`${__dirname}/${file}`).isFile() || !file.endsWith('.svelte')) continue;
    const content = fs.readFileSync(`${__dirname}/${file}`, 'utf-8');
    const isTsFile = content.includes('lang="ts"');
    const output = svelte2tsx(content, {version: VERSION, filename: file, isTsFile}).code;
    fs.writeFileSync(`${__dirname}/output/${file}.${isTsFile ? 'ts' : 'js'}`, output);
    console.log(output);
}

// If you're only interested in the index file:
// const content = fs.readFileSync(`${__dirname}/index.svelte`, 'utf-8');
// console.log(svelte2tsx(content, {version: VERSION,isTsFile: true}).code);

/**
 * To enable the REPL, simply run the "dev" package script.
 *
 * The "/repl/index.svelte" file will be converted to tsx
 * at "/repl/output/" using the modified source code on change.
 *
 * Alternatively you may run this file with a debugger attached,
 * to do so, hit "Ctrl+Shift+D" and select "svelte2tsx" in the dropdown.
 */
