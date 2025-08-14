import { htmlx2jsx } from '../build';
import { describe, it, expect } from 'vitest';
import { benchmark } from '../helpers';
import { parse } from 'svelte/compiler';

describe('htmlxparser', () => {
    it('parses in a reasonable time', () => {
        let random = '';
        let str = '';
        for (let i = 0; i !== 17; i++) random += Math.random().toString(26).slice(2);
        for (let i = 0; i !== 1137; i++) str += `${random} - line\t${i}\n`;
        const duration = benchmark(
            htmlx2jsx.bind(null, `<script> ${str} </script>` + `<style> ${str} </style>`, parse)
        );
        expect(duration).toBeLessThanOrEqual(1000);
    });
});
