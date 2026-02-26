/**
 * Benchmark: Incremental reparsing (with getChangeRange) vs full reparsing (without)
 *
 * This directly measures the performance difference that our getChangeRange()
 * implementation enables inside TypeScript's parser.
 *
 * Run: npx ts-node --project tsconfig.json test/plugins/typescript/incremental-reparse-benchmark.ts
 */
import ts from 'typescript';
import { performance } from 'perf_hooks';
import { computeChangeRange } from '../../../src/plugins/typescript/DocumentSnapshot';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function median(arr: number[]): number {
    const sorted = arr.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(arr: number[], p: number): number {
    const sorted = arr.slice().sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
}

function formatMs(ms: number): string {
    return ms < 1 ? `${(ms * 1000).toFixed(0)}µs` : `${ms.toFixed(2)}ms`;
}

// ---------------------------------------------------------------------------
// Generate realistic TypeScript source code of varying sizes
// ---------------------------------------------------------------------------

function generateTypeScriptSource(numFunctions: number): string {
    const lines: string[] = [
        '// Auto-generated TypeScript source for benchmarking',
        'import { Component } from "framework";',
        'import type { Config, Options, Result } from "./types";',
        '',
        'interface AppState {',
        '    count: number;',
        '    items: string[];',
        '    loading: boolean;',
        '    error: Error | null;',
        '}',
        '',
        'const DEFAULT_STATE: AppState = {',
        '    count: 0,',
        '    items: [],',
        '    loading: false,',
        '    error: null,',
        '};',
        ''
    ];

    for (let i = 0; i < numFunctions; i++) {
        lines.push(
            `function process_${i}(input: string, options?: Options): Result {`,
            `    const config: Config = { id: ${i}, name: "fn_${i}" };`,
            `    if (!input) {`,
            `        throw new Error("Invalid input for process_${i}");`,
            `    }`,
            `    const transformed = input`,
            `        .split("")`,
            `        .map((c, idx) => idx % 2 === 0 ? c.toUpperCase() : c.toLowerCase())`,
            `        .join("");`,
            `    return {`,
            `        value: transformed,`,
            `        metadata: {`,
            `            processor: "process_${i}",`,
            `            timestamp: Date.now(),`,
            `            config,`,
            `        },`,
            `    };`,
            `}`,
            ''
        );
    }

    // Add a class to make parsing more interesting
    lines.push(
        'export class DataProcessor<T extends Record<string, unknown>> {',
        '    private state: AppState = { ...DEFAULT_STATE };',
        '    private cache = new Map<string, T>();',
        '',
        '    constructor(private readonly options: Options) {}',
        '',
        '    async process(data: T[]): Promise<Result[]> {',
        '        this.state.loading = true;',
        '        try {',
        '            const results: Result[] = [];',
        '            for (const item of data) {',
        '                const key = JSON.stringify(item);',
        '                if (this.cache.has(key)) continue;',
        '                this.cache.set(key, item);',
        '                results.push(process_0(String(item), this.options));',
        '            }',
        '            this.state.items = results.map(r => r.value);',
        '            return results;',
        '        } catch (error) {',
        '            this.state.error = error as Error;',
        '            throw error;',
        '        } finally {',
        '            this.state.loading = false;',
        '        }',
        '    }',
        '}',
        ''
    );

    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Generate svelte2tsx-like output (more representative of Svelte language tools)
// ---------------------------------------------------------------------------

function generateSvelte2tsxOutput(numBindings: number): string {
    const lines: string[] = [
        '/// <reference types="svelte" />',
        ';function render() {',
        '',
        '    let count = 0;',
        '    let name = "world";',
        '    let items: string[] = [];',
        '    let loading = false;',
        ''
    ];

    for (let i = 0; i < numBindings; i++) {
        lines.push(
            `    let value_${i} = "";`,
            `    $: derived_${i} = value_${i}.toUpperCase();`,
            `    $: if (value_${i}.length > 0) {`,
            `        console.log("value_${i} changed:", value_${i});`,
            `    }`,
            `    function handleChange_${i}(event: Event) {`,
            `        const target = event.target as HTMLInputElement;`,
            `        value_${i} = target.value;`,
            `    }`,
            ''
        );
    }

    lines.push(
        '    ;() => {',
        '    <>',
        ''
    );

    for (let i = 0; i < numBindings; i++) {
        lines.push(
            `    <input value={value_${i}} oninput={handleChange_${i}} />`,
            `    <p>{derived_${i}}</p>`
        );
    }

    lines.push(
        '    </>',
        '    return { props: {}, slots: {}, events: {} }}',
        '',
        'export default class extends __sveltets_2_createSvelte2TsxComponent(__sveltets_2_partial(__sveltets_2_with_any_event(render()))) {}',
        ''
    );

    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Types of edits to simulate
// ---------------------------------------------------------------------------

type EditKind = 'insert_middle' | 'insert_end' | 'delete_line' | 'replace_word' | 'add_function';

function applyEdit(source: string, kind: EditKind): string {
    const lines = source.split('\n');
    const mid = Math.floor(lines.length / 2);

    switch (kind) {
        case 'insert_middle': {
            // Insert a single line in the middle (simulates typing a line)
            lines.splice(mid, 0, '    const newVariable = "inserted_value";');
            return lines.join('\n');
        }
        case 'insert_end': {
            // Insert at end (simulates adding code at bottom)
            lines.splice(lines.length - 2, 0, 'const appended = true;');
            return lines.join('\n');
        }
        case 'delete_line': {
            // Delete a line in the middle
            lines.splice(mid, 1);
            return lines.join('\n');
        }
        case 'replace_word': {
            // Replace a word on a line (simulates renaming)
            if (lines[mid]) {
                lines[mid] = lines[mid].replace(/const/, 'let');
            }
            return lines.join('\n');
        }
        case 'add_function': {
            // Add a small function (simulates adding a new block)
            const newFn = [
                '',
                'function newlyAdded(x: number): number {',
                '    return x * 2 + 1;',
                '}'
            ];
            lines.splice(mid, 0, ...newFn);
            return lines.join('\n');
        }
    }
}

// ---------------------------------------------------------------------------
// Core benchmark: full reparse vs incremental reparse
// ---------------------------------------------------------------------------

interface BenchmarkResult {
    label: string;
    sourceSize: number;
    editKind: EditKind;
    fullReparseMs: number[];
    incrementalReparseMs: number[];
}

function runSingleBenchmark(
    label: string,
    originalSource: string,
    editKind: EditKind,
    iterations: number
): BenchmarkResult {
    const editedSource = applyEdit(originalSource, editKind);
    const changeRange = computeChangeRange(originalSource, editedSource);

    // Warm up - create a few source files and do incremental parses
    for (let i = 0; i < 5; i++) {
        ts.createSourceFile('benchmark.ts', editedSource, ts.ScriptTarget.Latest, true);
        const sf = ts.createSourceFile('benchmark.ts', originalSource, ts.ScriptTarget.Latest, true);
        ts.updateSourceFile(sf, editedSource, changeRange);
    }

    // Benchmark full reparse
    const fullTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        ts.createSourceFile('benchmark.ts', editedSource, ts.ScriptTarget.Latest, true);
        fullTimes.push(performance.now() - start);
    }

    // Benchmark incremental reparse
    // TS marks source files as "already incrementally parsed" after updateSourceFile,
    // so we need a fresh source file for each iteration.
    // We pre-create all source files to avoid measuring createSourceFile time.
    const sourceFiles: ts.SourceFile[] = [];
    for (let i = 0; i < iterations; i++) {
        sourceFiles.push(
            ts.createSourceFile('benchmark.ts', originalSource, ts.ScriptTarget.Latest, true)
        );
    }

    const incrTimes: number[] = [];
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        ts.updateSourceFile(sourceFiles[i], editedSource, changeRange);
        incrTimes.push(performance.now() - start);
    }

    return {
        label,
        sourceSize: originalSource.length,
        editKind,
        fullReparseMs: fullTimes,
        incrementalReparseMs: incrTimes
    };
}

// ---------------------------------------------------------------------------
// Also benchmark the computeChangeRange itself to show its overhead is tiny
// ---------------------------------------------------------------------------

function benchmarkComputeChangeRange(
    originalSource: string,
    editedSource: string,
    iterations: number
): number[] {
    // Warm up
    for (let i = 0; i < 10; i++) {
        computeChangeRange(originalSource, editedSource);
    }

    const times: number[] = [];
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        computeChangeRange(originalSource, editedSource);
        times.push(performance.now() - start);
    }
    return times;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
    const ITERATIONS = 200;

    console.log('='.repeat(80));
    console.log('  Incremental Reparsing Benchmark');
    console.log('  TypeScript ' + ts.version);
    console.log('  Iterations per measurement: ' + ITERATIONS);
    console.log('='.repeat(80));
    console.log();

    const scenarios: Array<{
        label: string;
        source: string;
        editKinds: EditKind[];
    }> = [
        {
            label: 'Small TS file (~50 functions, ~1KB)',
            source: generateTypeScriptSource(3),
            editKinds: ['insert_middle', 'replace_word', 'delete_line']
        },
        {
            label: 'Medium TS file (~200 functions, ~15KB)',
            source: generateTypeScriptSource(50),
            editKinds: ['insert_middle', 'replace_word', 'delete_line', 'add_function']
        },
        {
            label: 'Large TS file (~500 functions, ~40KB)',
            source: generateTypeScriptSource(150),
            editKinds: ['insert_middle', 'replace_word', 'delete_line', 'add_function']
        },
        {
            label: 'Svelte2tsx output (~20 bindings)',
            source: generateSvelte2tsxOutput(20),
            editKinds: ['insert_middle', 'replace_word', 'add_function']
        },
        {
            label: 'Svelte2tsx output (~80 bindings, large component)',
            source: generateSvelte2tsxOutput(80),
            editKinds: ['insert_middle', 'replace_word', 'add_function']
        }
    ];

    const allResults: BenchmarkResult[] = [];

    for (const scenario of scenarios) {
        console.log(`\n${'─'.repeat(70)}`);
        console.log(`  ${scenario.label}`);
        console.log(`  Source size: ${scenario.source.length} chars, ${scenario.source.split('\n').length} lines`);
        console.log(`${'─'.repeat(70)}`);

        for (const editKind of scenario.editKinds) {
            const result = runSingleBenchmark(
                scenario.label,
                scenario.source,
                editKind,
                ITERATIONS
            );
            allResults.push(result);

            const fullMedian = median(result.fullReparseMs);
            const incrMedian = median(result.incrementalReparseMs);
            const speedup = fullMedian / incrMedian;

            // Also measure computeChangeRange overhead
            const editedSource = applyEdit(scenario.source, editKind);
            const changeRangeTimes = benchmarkComputeChangeRange(
                scenario.source,
                editedSource,
                ITERATIONS
            );
            const changeRangeMedian = median(changeRangeTimes);

            console.log();
            console.log(`  Edit: ${editKind}`);
            console.log(`    Full reparse:        median ${formatMs(fullMedian)}, p95 ${formatMs(percentile(result.fullReparseMs, 95))}`);
            console.log(`    Incremental reparse: median ${formatMs(incrMedian)}, p95 ${formatMs(percentile(result.incrementalReparseMs, 95))}`);
            console.log(`    computeChangeRange:  median ${formatMs(changeRangeMedian)}`);
            console.log(`    Net speedup (incl. computeChangeRange): ${(fullMedian / (incrMedian + changeRangeMedian)).toFixed(1)}x`);
            console.log(`    Speedup (reparse only): ${speedup.toFixed(1)}x`);
        }
    }

    // Summary table
    console.log();
    console.log('='.repeat(80));
    console.log('  SUMMARY');
    console.log('='.repeat(80));
    console.log();
    console.log(
        'Source Size'.padEnd(14) +
        'Edit Type'.padEnd(18) +
        'Full'.padEnd(12) +
        'Incremental'.padEnd(14) +
        'Speedup'.padEnd(10)
    );
    console.log('─'.repeat(68));

    for (const r of allResults) {
        const fullMedian = median(r.fullReparseMs);
        const incrMedian = median(r.incrementalReparseMs);
        const speedup = fullMedian / incrMedian;

        console.log(
            `${(r.sourceSize / 1000).toFixed(1)}KB`.padEnd(14) +
            r.editKind.padEnd(18) +
            formatMs(fullMedian).padEnd(12) +
            formatMs(incrMedian).padEnd(14) +
            `${speedup.toFixed(1)}x`
        );
    }

    console.log();

    // Overall assessment
    const speedups = allResults.map((r) => median(r.fullReparseMs) / median(r.incrementalReparseMs));
    const avgSpeedup = speedups.reduce((a, b) => a + b, 0) / speedups.length;
    const minSpeedup = Math.min(...speedups);
    const maxSpeedup = Math.max(...speedups);

    console.log(`Average speedup: ${avgSpeedup.toFixed(1)}x`);
    console.log(`Range: ${minSpeedup.toFixed(1)}x - ${maxSpeedup.toFixed(1)}x`);
    console.log();

    if (avgSpeedup >= 2) {
        console.log('RESULT: Significant improvement. Incremental reparsing is substantially faster.');
    } else if (avgSpeedup >= 1.3) {
        console.log('RESULT: Moderate improvement. Incremental reparsing provides measurable benefit.');
    } else {
        console.log('RESULT: Minimal improvement at the parser level for these file sizes.');
        console.log('Note: The real benefit may be larger in the full language service pipeline');
        console.log('where TS also avoids re-checking unchanged code.');
    }
}

main();
