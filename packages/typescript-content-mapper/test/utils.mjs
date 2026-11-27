import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after } from 'node:test';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-content-mapper-test-'));
after(() => fs.rmSync(root, { recursive: true, force: true }));
let count = 0;

/**
 * Creates a directory in the temp directory with fake TypeScript packages in its node_modules:
 * `{ typescript: '7.1.0', '@typescript/native': '6.0.3' }` (each one a `typescript` package with
 * that version, the alias like `npm:typescript@...` installs it), plus `files`.
 */
export function createProject(packages, files = {}) {
    const dir = path.join(root, `project-${++count}`);
    for (const [name, version] of Object.entries(packages)) {
        writeFile(
            path.join(dir, 'node_modules', name, 'package.json'),
            JSON.stringify({ name: 'typescript', version })
        );
    }
    for (const [name, content] of Object.entries(files)) {
        writeFile(path.join(dir, name), content);
    }
    fs.mkdirSync(dir, { recursive: true });
    return fs.realpathSync(dir);
}

export function writeFile(file, content) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
}
