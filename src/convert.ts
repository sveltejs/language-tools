import { svelte2tsx } from './svelte2tsx'
import * as fs from 'fs';

let source = process.argv[2]
let content = fs.readFileSync(source);
process.stdout.write(svelte2tsx(content.toString()).code);


