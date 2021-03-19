import assert from 'assert';
import { decode } from 'sourcemap-codec';
import svelte2tsx from '../build';
import { color, each_sample, GenerateFn, get_svelte2tsx_config, Sample } from '../helpers';
import { print_string } from './helpers';
import {
    handler,
    is_edit_changed,
    is_edit_empty,
    is_edit_from_same_generated,
    is_test_empty,
    is_test_from_same_input,
    validate_edit_file,
    validate_test_file
} from './process';

describe('sourcemaps', function () {
    for (const sample of each_sample(__dirname)) {
        if (process.env.CI) {
            sample.checkDirectory({ required: ['*.svelte', 'mappings.jsx', 'test.jsx'] });
        } else {
            sample.checkDirectory({
                required: ['*.svelte'],
                allowed: ['mappings.jsx', 'test.jsx', 'test.edit.jsx', 'output.tsx']
            });
            maybe_generate(sample, regenerate);
            sample.onError(function (generate, err) {
                const skip = (err as Error).message.includes('SourceMapping changed');
                regenerate(generate, skip);
            });
        }

        sample.it(function () {
            const parsed = parse(sample);

            parsed.each_test_range(
                sample.get('test.jsx'),
                function (actual, expected) {
                    assert.strictEqual(actual, expected);
                },
                function () {
                    throw new Error(`Invalid test file format at ${sample.directory}/test.jsx`);
                },
                function (ranges) {
                    throw new Error(
                        `Could not find the following snippets in generated output\n` +
                            ranges.map((range) => `\t"${print_string(range[2])}"`).join('\n') +
                            (process.env.CI
                                ? ''
                                : `\nTo edit ranges : ${sample.directory}/test.edit.jsx`)
                    );
                }
            );

            assert.strictEqual(
                parsed.print_mappings(),
                sample.get('mappings.jsx'),
                `SourceMapping changed, run tests locally to re-generate results.`
            );
        });

        function regenerate(generate: GenerateFn, skip = false) {
            const parsed = parse(sample);
            generate_passive(generate, parsed, skip);
            if (!sample.has('test.jsx')) generate('test.jsx', parsed.generate_test(), skip);
            generate('test.edit.jsx', parsed.generate_test_edit(sample.get('test.jsx')), skip);
        }
    }
});

function maybe_generate(sample: Sample, regenerate: (generate: GenerateFn) => void) {
    const svelteFile = sample.wildcard('*.svelte');

    if (sample.hasOnly(svelteFile)) {
        sample.log(color.green(`[New] Sample ${sample.name}`));
        return sample.generateDeps(regenerate);
    }

    if (sample.has('test.edit.jsx')) {
        const edit = sample.get('test.edit.jsx');

        try {
            validate_edit_file(edit);
        } catch (err) {
            return sample.generateDeps(function (generate) {
                generate_passive(generate, parse(sample));
                err.message += `\n\tat ${sample.directory}/test.edit.jsx`;
                throw err;
            });
        }

        const edit_changed = is_edit_changed(edit);

        if (edit_changed || !sample.has('test.jsx')) {
            return sample.generateDeps(function (generate) {
                const parsed = parse(sample);
                if (is_edit_empty(edit)) {
                    generate('test.jsx', parsed.generate_test());
                    generate('test.edit.jsx', parsed.generate_test_edit());
                    generate_passive(generate, parsed);
                    return;
                }
                if (is_edit_from_same_generated(edit, parsed.generated)) {
                    const new_test = parsed.generate_test(edit);
                    generate('test.jsx', new_test);
                    generate('test.edit.jsx', parsed.generate_test_edit(new_test));
                    generate_passive(generate, parsed);
                    return;
                }
                const err = edit_changed ? 'apply changes made to' : 'generate "test.jsx" from';
                throw new Error(
                    '' +
                        `Failed to ${err} "test.edit.jsx" as it is based on a stale output.\n` +
                        `\tEither reverse output changes or delete "test.edit.jsx" manually before running tests again\n` +
                        `\tcmd-click : ${sample.directory}/test.edit.jsx\n`
                );
            });
        }
    }

    if (!sample.has('mappings.jsx') || (!sample.has('test.jsx') && !sample.has('test.edit.jsx'))) {
        sample.log(color.yellow(`[Repaired] Uncomplete Sample ${sample.name}`));
        return sample.generateDeps(regenerate);
    }

    const test = sample.get('test.jsx');
    try {
        validate_test_file(test);
    } catch (err) {
        return sample.generateDeps(function (generate) {
            generate_passive(generate, parse(sample));
            err.message += `\n\tat ${sample.directory}/test.jsx`;
            throw err;
        });
    }
    if (!is_test_from_same_input(test, sample.get(svelteFile))) {
        return sample.generateDeps(function (generate) {
            const parsed = parse(sample);
            generate_passive(generate, parsed);
            generate('test.edit.jsx', parsed.generate_test_edit());
            if (is_test_empty(test)) {
                generate('test.jsx', parsed.generate_test());
                return;
            }
            throw new Error(
                '' +
                    `Test input at "${svelteFile}" changed, thus making "test.jsx" invalid.\n` +
                    `\tEither manually re-select all tested ranges in the newly generated "test.edit.jsx", delete "test.jsx" or undo input changes.\n` +
                    `\tcmd-click : ${sample.directory}/test.edit.jsx\n`
            );
        });
    }
}

function generate_passive(generate: GenerateFn, parsed: Parsed, skip = false) {
    generate('output.tsx', parsed.inline, skip);
    generate('mappings.jsx', parsed.print_mappings(), skip);
}

type Parsed = ReturnType<typeof handler> & { generated: string; inline: string };
const cache = new WeakMap<Sample, Parsed>();
function parse(sample: Sample): Parsed {
    if (!cache.has(sample)) {
        const filename = sample.wildcard('*.svelte');
        const original = sample.get(filename);
        const { code, map } = svelte2tsx(
            original,
            get_svelte2tsx_config({ filename }, sample.name)
        );

        map.file = 'output.tsx';
        map.sources = [filename];
        map.sourcesContent = [original];

        const mapped = handler(original, code, decode(map.mappings) as any);
        cache.set(sample, {
            ...mapped,
            generated: code,
            inline: code + `\n//# sourceMappingURL=${map.toUrl()}`
        });
    }
    return cache.get(sample);
}
