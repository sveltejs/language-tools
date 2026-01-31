import * as path from 'node:path';
import { check, parseArgsAsCheckConfig } from './index.js';

const args = parseArgsAsCheckConfig(process.argv);

console.info(`Getting diagnostics for Svelte files in ${path.resolve(args.root)}...`);

const result = await check(args);

if (typeof result === 'boolean') {
	process.exit(result ? 1 : 0);
}
