import fs from 'fs';
import svelte2tsx from '../src';
const content = fs.readFileSync(`${__dirname}/index.svelte`, 'utf-8');
svelte2tsx(content);
debugger;

/**
 * Run the "dev" package script to get started
 * 
 * Inputs at "repl/index.svelte" use the modified source code
 * and are compiled to "repl/output/" on save.
 * 
 * Alternatively, attach a debugger to the "debug" package script
 * and place breakpoints directly in the ts source files.
 */
