import type ts from 'typescript';

export const TsScriptKind = {
    Unknown: 0 satisfies ts.ScriptKind.Unknown,
    JS: 1 satisfies ts.ScriptKind.JS,
    JSX: 2 satisfies ts.ScriptKind.JSX,
    TS: 3 satisfies ts.ScriptKind.TS,
    TSX: 4 satisfies ts.ScriptKind.TSX,
    External: 5 satisfies ts.ScriptKind.External,
    JSON: 6 satisfies ts.ScriptKind.JSON,
    Deferred: 7 satisfies ts.ScriptKind.Deferred
};

export enum TsExtension {
    Ts = '.ts',
    Tsx = '.tsx',
    Dts = '.d.ts',
    Js = '.js',
    Jsx = '.jsx',
    Json = '.json',
    TsBuildInfo = '.tsbuildinfo',
    Mjs = '.mjs',
    Mts = '.mts',
    Dmts = '.d.mts',
    Cjs = '.cjs',
    Cts = '.cts',
    Dcts = '.d.cts'
}
