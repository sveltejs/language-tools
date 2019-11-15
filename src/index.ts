export { svelte2tsx } from './svelte2tsx'
export { htmlx2jsx } from './htmlxtojsx'

//* try tp get errors
import * as ts from "typescript";
import * as path from "path";
import { compile, parseConfigFile } from './compiler';
import { Warning } from 'svelte/types/compiler/interfaces';



function reportDiagnostic(d: Warning) {        
    let output = `${d.code.toUpperCase()} (${d.filename}:${d.start.line}:${d.start.column}) ${ d.message }\n`;
    process.stdout.write(output);
}
    


//cli?
if (require.main === module) {
    console.log("Compiling test")
    let sources = process.argv.slice(2);
    sources.unshift("svelte-jsx.d.ts");
    sources.unshift("svelte-shims.d.ts");
    console.log(ts.sys.resolvePath("node_modules/typescript/lib"));

    let conf = parseConfigFile(path.resolve(__dirname, "./test2/tsconfig.json"));

    let diags = compile(conf.options, conf.fileNames);
    diags.forEach(reportDiagnostic)
}