import path from 'path';
import { svelte2tsx } from '../../build';
import { get_svelte2tsx_config, test_samples } from '../../helpers';

describe('svelte2tsx basic tests', () => {
    it('should transform a simple component', () => {
        const input = `
      <script>
        let count = 0;
        function increment() {
          count += 1;
        }
      </script>

      <button on:click={increment}>
        Clicks: {count}
      </button>
    `;

        const { code } = svelte2tsx(input, {
            filename: 'Test.svelte',
            isTsFile: false,
            emitOnTemplateError: false,
            namespace: null,
            mode: 'ts',
            accessors: false,
            typingsNamespace: 'svelteHTML'
        });

        // Basic assertions to verify transformation worked
        expect(code).toContain('let count = 0');
        expect(code).toContain('function increment()');
        expect(code).toContain('on:click');
    });
});

describe('svelte2tsx', () => {
    const dir = path.join(__dirname, '../../svelte2tsx');
    test_samples(
        dir,
        (input, config) => {
            return svelte2tsx(input, get_svelte2tsx_config(config, config.sampleName));
        },
        'ts'
    );
});
