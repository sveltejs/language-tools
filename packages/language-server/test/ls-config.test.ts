import * as assert from 'assert';
import ts from 'typescript';
import { LSConfigManager } from '../src/ls-config';

describe('LSConfigManager', () => {
    describe('#update', () => {
        it('starts with default config before any update', () => {
            const manager = new LSConfigManager(ts);
            assert.strictEqual(manager.get('typescript.diagnostics.enable'), true);
            assert.strictEqual(manager.get('svelte.format.config.printWidth'), 80);
        });

        it('applies a partial update while preserving defaults for unspecified fields', () => {
            const manager = new LSConfigManager(ts);
            manager.update({ svelte: { diagnostics: { enable: false } } });

            // updated field
            assert.strictEqual(manager.get('svelte.diagnostics.enable'), false);
            // unrelated fields should retain their defaults
            assert.strictEqual(manager.get('typescript.enable'), true);
            assert.strictEqual(manager.get('typescript.diagnostics.enable'), true);
            assert.strictEqual(manager.get('css.enable'), true);
            assert.strictEqual(manager.get('svelte.format.enable'), true);
        });

        it('preserves false boolean values from the update (not overridden by defaults)', () => {
            const manager = new LSConfigManager(ts);
            manager.update({ typescript: { diagnostics: { enable: false } } });
            assert.strictEqual(manager.get('typescript.diagnostics.enable'), false);
        });

        it('preserves false values across multiple sequential updates', () => {
            const manager = new LSConfigManager(ts);
            manager.update({ typescript: { diagnostics: { enable: false } } });
            manager.update({ svelte: { diagnostics: { enable: false } } });

            // both should be preserved
            assert.strictEqual(manager.get('typescript.diagnostics.enable'), false);
            assert.strictEqual(manager.get('svelte.diagnostics.enable'), false);
        });

        it('a later update can re-enable a previously disabled feature', () => {
            const manager = new LSConfigManager(ts);
            manager.update({ typescript: { diagnostics: { enable: false } } });
            assert.strictEqual(manager.get('typescript.diagnostics.enable'), false);

            manager.update({ typescript: { diagnostics: { enable: true } } });
            assert.strictEqual(manager.get('typescript.diagnostics.enable'), true);
        });

        it('a later update does not lose unrelated fields from a prior update', () => {
            const manager = new LSConfigManager(ts);
            manager.update({
                typescript: { diagnostics: { enable: false } },
                css: { enable: false }
            });
            manager.update({ svelte: { enable: false } });

            assert.strictEqual(manager.get('typescript.diagnostics.enable'), false);
            assert.strictEqual(manager.get('css.enable'), false);
            assert.strictEqual(manager.get('svelte.enable'), false);
        });

        it('handles undefined config gracefully (no-op)', () => {
            const manager = new LSConfigManager(ts);
            manager.update(undefined);
            // defaults should still be intact
            assert.strictEqual(manager.get('typescript.diagnostics.enable'), true);
            assert.strictEqual(manager.get('svelte.format.config.printWidth'), 80);
        });

        it('replaces compilerWarnings completely rather than merging', () => {
            const manager = new LSConfigManager(ts);
            manager.update({ svelte: { compilerWarnings: { 'a11y-alt-text': 'error' } } });
            assert.deepStrictEqual(manager.get('svelte.compilerWarnings'), {
                'a11y-alt-text': 'error'
            });

            // second update should fully replace, not merge with previous warnings
            manager.update({
                svelte: { compilerWarnings: { 'no-unused-vars': 'error' } }
            });
            assert.deepStrictEqual(manager.get('svelte.compilerWarnings'), {
                'no-unused-vars': 'error'
            });
        });

        it('notifies listeners when config changes', (done) => {
            const manager = new LSConfigManager(ts);
            manager.onChange(() => done());
            manager.update({ typescript: { enable: false } });
        });
    });

    describe('#get', () => {
        it('retrieves a top-level value by dot path', () => {
            const manager = new LSConfigManager(ts);
            const tsConfig = manager.get('typescript');
            assert.strictEqual(typeof tsConfig, 'object');
            assert.notStrictEqual(tsConfig, null);
        });

        it('retrieves nested boolean defaults by dot path', () => {
            const manager = new LSConfigManager(ts);
            assert.strictEqual(manager.get('typescript.diagnostics.enable'), true);
            assert.strictEqual(manager.get('svelte.format.config.svelteStrictMode'), false);
            assert.strictEqual(manager.get('svelte.format.config.svelteAllowShorthand'), true);
        });

        it('retrieves a nested string default by dot path', () => {
            const manager = new LSConfigManager(ts);
            assert.strictEqual(
                manager.get('svelte.format.config.svelteSortOrder'),
                'options-scripts-markup-styles'
            );
        });

        it('retrieves a nested number default by dot path', () => {
            const manager = new LSConfigManager(ts);
            assert.strictEqual(manager.get('svelte.format.config.printWidth'), 80);
        });

        it('returns undefined for a completely unknown path', () => {
            const manager = new LSConfigManager(ts);
            assert.strictEqual(manager.get('does.not.exist'), undefined);
        });

        it('returns undefined when a path segment does not exist mid-chain', () => {
            const manager = new LSConfigManager(ts);
            assert.strictEqual(manager.get('typescript.nonexistent.something'), undefined);
        });

        it('reflects a value set by update()', () => {
            const manager = new LSConfigManager(ts);
            manager.update({ svelte: { format: { config: { printWidth: 120 } } } });
            assert.strictEqual(manager.get('svelte.format.config.printWidth'), 120);
        });
    });

    describe('#getMergedPrettierConfig', () => {
        it('returns prettierFromFileConfig directly when it has keys', () => {
            const manager = new LSConfigManager(ts);
            const fileConfig = { printWidth: 100, tabWidth: 2 };
            const result = manager.getMergedPrettierConfig(fileConfig);
            assert.deepStrictEqual(result, fileConfig);
        });

        it('returns undefined/falsy for an empty prettierFromFileConfig and falls back', () => {
            const manager = new LSConfigManager(ts);
            const result = manager.getMergedPrettierConfig({});
            // empty file config → falls back to svelte format config
            assert.strictEqual(result.printWidth, 80);
        });

        it('falls back to svelte format config when no prettierFromFileConfig and no prettier config', () => {
            const manager = new LSConfigManager(ts);
            const result = manager.getMergedPrettierConfig(undefined);
            assert.strictEqual(result.printWidth, 80);
            assert.strictEqual(result.singleQuote, false);
            assert.strictEqual(result.svelteAllowShorthand, true);
        });

        it('prettier extension config values take priority over svelte format config', () => {
            const manager = new LSConfigManager(ts);
            manager.updatePrettierConfig({ printWidth: 120 });
            const result = manager.getMergedPrettierConfig(undefined);
            assert.strictEqual(result.printWidth, 120);
        });

        it('prettier extension config fills in extra properties not in svelte format config', () => {
            const manager = new LSConfigManager(ts);
            manager.updatePrettierConfig({ tabWidth: 4 });
            const result = manager.getMergedPrettierConfig(undefined);
            assert.strictEqual(result.tabWidth, 4);
            // svelte-specific defaults still present
            assert.strictEqual(result.printWidth, 80);
        });

        it('prettier extension config does not override unset fields (defu semantics)', () => {
            const manager = new LSConfigManager(ts);
            // svelte format config has printWidth: 80, prettier config doesn't set it
            manager.updatePrettierConfig({ tabWidth: 2 });
            const result = manager.getMergedPrettierConfig(undefined);
            assert.strictEqual(result.printWidth, 80);
        });

        it('overridesWhenNoPrettierConfig is used when no prettier extension config is set', () => {
            const manager = new LSConfigManager(ts);
            const result = manager.getMergedPrettierConfig(undefined, { trailingComma: 'all' });
            assert.strictEqual(result.trailingComma, 'all');
            // svelte format config still fills in the rest
            assert.strictEqual(result.printWidth, 80);
        });

        it('prettier extension config takes priority over overridesWhenNoPrettierConfig', () => {
            const manager = new LSConfigManager(ts);
            manager.updatePrettierConfig({ trailingComma: 'none' });
            const result = manager.getMergedPrettierConfig(undefined, { trailingComma: 'all' });
            // prettier config should win
            assert.strictEqual(result.trailingComma, 'none');
        });
    });
});
