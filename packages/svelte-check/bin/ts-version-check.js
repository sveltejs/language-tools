// @ts-check

let version;
try {
    const pkg = require('typescript/package.json');
    version = pkg.version;
} catch {}
checkTypeScriptVersion(version);

/**
 *
 * @param {string | undefined} version
 * @returns
 */
function checkTypeScriptVersion(version) {
    const requirement = 'svelte-check requires TypeScript >= 5.0 and <= 6.0. ';

    let message = '';
    if (version) {
        const major = parseInt(version.split('.')[0], 10);
        if (major < 5) {
            message +=
                requirement + `You are using unsupported TypeScript ${version}. \n\nNote that `;
        } else if (major < 7) {
            return;
        }
    } else {
        message +=
            'TypeScript is not installed in the workspace. ' + requirement + '\n\nNote that ';
    }

    message +=
        'TypeScript 7 support currently requires both TypeScript 7 and TypeScript 6 installed in your project, ' +
        'and requires using the --tsgo or --tsgo-experimental-api flag. ' +
        'You can setup both version with an npm alias via the following command.\n' +
        'npm install --save-dev typescript@~6 @typescript/native@npm:typescript@7\n';

    throw new Error(message);
}
