declare module 'svelte' {
    export type SourceMap = any;

    export interface CodeMap {
        code: string;
        map?: SourceMap | string;
    }

    export type PreprocessorOutput = CodeMap | void | Promise<CodeMap | void>;

    export interface PreprocessOptions {
        markup?: (options: { content: string; filename?: string }) => PreprocessorOutput;
        style?: Preprocessor;
        script?: Preprocessor;
        filename?: string;
    }

    export type Preprocessor = (
        options: {
            content: string;
            attributes: Record<string, string | boolean>;
            filename?: string;
        },
    ) => PreprocessorOutput;

    export interface Processed {
        toString(): string;
    }

    export function preprocess(source: string, config: PreprocessOptions): Promise<Processed>;

    export interface Warning {
        loc?: { line: number; column: number; pos?: number };
        end?: { line: number; column: number };
        pos?: number;
        message: string;
        code: string;
        filename?: string;
        frame?: string;
        toString: () => string;
    }

    export interface CustomElementOptions {
        tag?: string;
        props?: string[];
    }

    export type ModuleFormat = 'es' | 'amd' | 'cjs' | 'iife' | 'umd' | 'eval';

    export class CompileError extends Error {
        frame: string;
        loc?: { line: number; column: number };
        end?: { line: number; column: number };
        pos: number;
        filename: string;
    }

    export interface CompileOptions {
        format?: ModuleFormat;
        name?: string;
        filename?: string;
        generate?: string;
        globals?: ((id: string) => string) | object;
        amd?: {
            id?: string;
        };

        outputFilename?: string;
        cssOutputFilename?: string;

        dev?: boolean;
        immutable?: boolean;
        shared?: boolean | string;
        cascade?: boolean;
        hydratable?: boolean;
        legacy?: boolean;
        customElement?: CustomElementOptions | true;
        css?: boolean;
        store?: boolean;

        onerror?: (error: CompileError) => void;
        onwarn?: (warning: Warning) => void;
    }

    export function compile(source: string, config: CompileOptions): any;

    export interface Node {
        start: number;
        end: number;
        type: string;
        [propName: string]: any;
    }

    export interface Parsed {
        hash: number;
        html: Node;
        css: Node;
        js: Node;
        errors: CompileError[];
    }

    export interface ParserOptions {
        filename?: string;
        bind?: boolean;
    }

    export function parse(template: string, options?: ParserOptions): Parsed;

    export class Stylesheet {
        source: string;
        parsed: Parsed;
        cascade: boolean;
        filename: string;
        dev: boolean;

        hasStyles: boolean;
        id: string;

        // children: (Rule | Atrule)[];
        keyframes: Map<string, string>;

        nodesWithCssClass: Set<Node>;

        constructor(
            source: string,
            parsed: Parsed,
            filename: string,
            cascade: boolean,
            dev: boolean,
        );
    }

    export function validate(
        parsed: Parsed,
        source: string,
        stylesheet: Stylesheet,
        options: CompileOptions,
    ): void;
}
