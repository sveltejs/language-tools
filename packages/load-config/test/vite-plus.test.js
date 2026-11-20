const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, describe, it } = require('node:test');
const { loadConfig } = require('../dist/src/index.js');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'load-config-'));
let projectCount = 0;

after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

/**
 * Creates a project with a vite config and a fake package that stands in for Vite.
 * Its `resolveConfig` reports a Svelte plugin carrying the given options.
 */
function createProject(packages) {
    const root = path.join(tmpRoot, `project-${projectCount++}`);
    fs.mkdirSync(root);
    fs.writeFileSync(path.join(root, 'vite.config.js'), 'export default {};\n');

    for (const [name, options] of Object.entries(packages)) {
        const dir = path.join(root, 'node_modules', name);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'package.json'),
            JSON.stringify({
                name,
                version: '1.0.0',
                type: 'module',
                exports: { '.': { import: './index.js' }, './package.json': './package.json' }
            })
        );
        fs.writeFileSync(
            path.join(dir, 'index.js'),
            `export async function resolveConfig() {
    return { plugins: [{ name: 'vite-plugin-svelte:config', api: { options: ${JSON.stringify(options)} } }] };
}
`
        );
    }

    return root;
}

describe('loadConfig with a vite config', () => {
    it('loads the Svelte config through vite', async () => {
        const root = createProject({ vite: { from: 'vite' } });

        const result = await loadConfig(root, { traverse: false });

        assert.equal(result.configSource, 'vite');
        assert.equal(result.config.from, 'vite');
    });

    it('falls back to vite-plus when vite is not installed in the project', async () => {
        const root = createProject({ 'vite-plus': { from: 'vite-plus' } });

        const result = await loadConfig(root, { traverse: false });

        assert.equal(result?.configSource, 'vite');
        assert.equal(result?.config.from, 'vite-plus');
    });

    it('prefers vite over vite-plus when both are installed', async () => {
        const root = createProject({ vite: { from: 'vite' }, 'vite-plus': { from: 'vite-plus' } });

        const result = await loadConfig(root, { traverse: false });

        assert.equal(result.config.from, 'vite');
    });
});
