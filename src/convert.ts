import { svelte2jsx } from './index'
import * as fs from 'fs';

let source = process.argv[2]
let content = fs.readFileSync(source);
process.stdout.write(svelte2jsx(content.toString()).code);


