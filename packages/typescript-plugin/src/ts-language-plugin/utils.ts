import { TSPluginContext } from ".";
import { LineChar, LineOffset } from "./types";
type ExtractMethods<T extends object> = {
	[K in keyof T]: Extract<T[K], (...args: any[]) => any>;
};
type MethodKeys<T extends object> = keyof ExtractMethods<T>;
export function override<T extends object, O extends Required<T>>(
	target: T,
	obj: {
		[K in MethodKeys<O>]?: O[K] extends (...args: infer P) => infer R ? (this: T, fn: O[K], ...args: P) => R : never;
	},
) {
	for (const key in obj) {
		(target as O)[key] = obj[key].bind(target, ((target as O)[key] as any)?.bind(target)) as any;
	}
	return target;
}
export function addSideEffects<T extends object, O extends Required<T>>(
	target: T,
	obj: {
		[K in MethodKeys<O>]?: O[K] extends (...args: infer P) => infer R ? (this: T, result: R, ...args: P) => void : never;
	},
) {
	const o = {};
	for (const key in obj) {
		const fn = obj[key].bind(target); // @ts-ignore
		o[key] = function (_, ...args) {
			const result = _(...args);
			fn(result, ...args);
			return result;
		};
	}
	override(target, o);
}
export function testForExtension(extension: string) {
	const re = new RegExp(`\\.${extension.replace(/^\./, "")}$`);
	return re.test.bind(re);
}
export function getText(script: ts.IScriptSnapshot) {
	return script.getText(0, script.getLength());
}
export function getExtensionFromScriptKind({ ts }: TSPluginContext, kind: ts.ScriptKind): ts.Extension | undefined {
	switch (kind) {
		case ts.ScriptKind.JS:
			return ts.Extension.Js;
		case ts.ScriptKind.JSON:
			return ts.Extension.Json;
		case ts.ScriptKind.JSX:
			return ts.Extension.Jsx;
		case ts.ScriptKind.TS:
			return ts.Extension.Ts;
		case ts.ScriptKind.TSX:
			return ts.Extension.Tsx;
		case ts.ScriptKind.Deferred:
		case ts.ScriptKind.External:
		case ts.ScriptKind.Unknown:
			return undefined;
	}
}
export function quote(str: string) {
	return `"${str}"`;
}
export function toPosition(lineStarts: number[], o: LineChar | LineOffset) {
	if ("offset" in o) return lineStarts[o.line - 1] + o.offset - 1;
	else return lineStarts[o.line] + o.character;
}
export function toLineChar(pos: LineOffset): LineChar {
	return { line: pos.line - 1, character: pos.offset - 1 };
}
export function toLineOffset(pos: LineChar): LineOffset {
	return { line: pos.line + 1, offset: pos.character + 1 };
}
export function extensionFromFileName(fileName: string) {
	return fileName.slice(fileName.lastIndexOf(".") + 1);
}
