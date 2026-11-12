// @ts-check

let version;
try {
    const pkg = require('typescript/package.json');
    version = pkg.version;
} catch {}
