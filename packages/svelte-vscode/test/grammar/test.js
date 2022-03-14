// @ts-check
const { spawn } = require('child_process');
const { readdirSync } = require('fs');
const { join, resolve } = require('path');

const dummyGrammarDir = resolve(__dirname, './dummy');
const dummyGrammars = readdirSync(dummyGrammarDir).map((file) => join(dummyGrammarDir, file));

const grammarDir = resolve(__dirname, '../../syntaxes');
const grammars = readdirSync(grammarDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => join(grammarDir, file));

const allGrammars = [...grammars, ...dummyGrammars];

/**
 *
 * @param  {Parameters<typeof spawn>} arg
 * @returns
 */
function promisifySpawn(...arg) {
    const childProcess = spawn(...arg);
    return new Promise((resolve) => {
        childProcess.on('exit', (code) => {
            resolve(code);
        });

        childProcess.on('error', (err) => {
            console.error(err);
            resolve(1);
        });
    });
}

async function snapShotTest() {
    const extraArgs = process.argv.slice(2);
    const args = [
        'vscode-tmgrammar-snap',
        '-s',
        'source.svelte',
        '-t',
        './test/grammar/samples/**/*.svelte',
        ...allGrammars.reduce((previous, path) => [...previous, '-g', path], []),
        ...extraArgs
    ];

    const code = await promisifySpawn(process.platform === 'win32' ? 'yarn.cmd' : 'yarn', args, {
        stdio: 'inherit'
    });

    if (code > 0) {
        process.exit(code);
    }
}

snapShotTest();
