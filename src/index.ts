export { svelte2tsx } from './svelte2tsx'
export { htmlx2jsx } from './htmlxtojsx'

//* try tp get errors
import * as ts from "typescript";
import * as path from "path";
import { compile, parseConfigFile } from './compiler';
import { SourceMapConsumer  } from 'source-map'

function getRelativeFileName(fileName: string): string {
    return path.relative(__dirname, fileName);
}



async function reportDiagnostics(diagnostics: ts.Diagnostic[]) {

    let consumers = new Map<ts.SourceFile, SourceMapConsumer>();

    async function reportDiagnostic(diagnostic: ts.Diagnostic) {
        let output = "";
    
        if (diagnostic.file) {
            let { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
    
            let sourceMap = (diagnostic.file as any).__svelte_map;
            let relativeFileName = getRelativeFileName(diagnostic.file.fileName);
           
            if (sourceMap) {
                let decoder = consumers.get(diagnostic.file);
                if (!decoder) {
                    decoder = await new SourceMapConsumer(sourceMap);
                    consumers.set(diagnostic.file, decoder);
                }
                let res = decoder.originalPositionFor({ line: line, column: character })
                line = res.line;
                character = res.column;
                relativeFileName = relativeFileName.substring(0, relativeFileName.lastIndexOf(".tsx"))
            }
    
           
            output += `${ relativeFileName }(${ line + 1 },${ character + 1 }): `;
        }
    
        const categoryFormatMap = {
            [ts.DiagnosticCategory.Warning]: "Warning",
            [ts.DiagnosticCategory.Error]: "Error",
            [ts.DiagnosticCategory.Message]: "Info",
        };
        let category = categoryFormatMap[diagnostic.category]
        output += `${ category } TS${ diagnostic.code }: ${ ts.flattenDiagnosticMessageText(diagnostic.messageText, ts.sys.newLine) }${ ts.sys.newLine }`;
    
       process.stdout.write(output);
    }
    


    for (const diagnostic of diagnostics) {
        reportDiagnostic(diagnostic);
    }
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
    reportDiagnostics(diags).catch(e => console.error(e));
}