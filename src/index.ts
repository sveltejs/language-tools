export { svelte2tsx } from './svelte2tsx'
export { htmlx2jsx } from './htmlxtojsx'

//* try tp get errors
import * as path from "path";
import { compile, parseConfigFile } from './compiler';
import { Warning } from 'svelte/types/compiler/interfaces';
import chalk from 'chalk'
export { compile, parseConfigFile };


function reportDiagnostic(d: Warning) {      
    let c = d.code.toLowerCase();
    let codeOutput = "info"
    if (c == "error") codeOutput = chalk`{red error}`
    if (c == "warning") codeOutput = chalk`{yellow error}`
    
    let output = chalk`{cyan ${d.filename}}{yellow :${d.start.line}:${d.start.column}} - ${codeOutput} ${d.message}\n\n`
    
    output += `${d.frame}\n\n`
    process.stdout.write(output);
}
    


//cli?
if (require.main === module) {
    let sources = process.argv.slice(2);
    sources.unshift("svelte-jsx.d.ts");
    sources.unshift("svelte-shims.d.ts");

    let conf = parseConfigFile(path.resolve(__dirname, "./test2/tsconfig.json"));

    let diags = compile(conf.options, conf.fileNames);
    diags.forEach(reportDiagnostic)
}