import MagicString from 'magic-string';
import { Node } from 'estree-walker';
import ts from 'typescript';
import { ImplicitStoreValues } from './nodes/ImplicitStoreValues';

export function processModuleScriptTag(
	str: MagicString,
	script: Node,
	implicitStoreValues: ImplicitStoreValues
) {
	const htmlx = str.original;

	resolveImplicitStores(htmlx, script, implicitStoreValues, str);

	const scriptStartTagEnd = htmlx.indexOf('>', script.start) + 1;
	const scriptEndTagStart = htmlx.lastIndexOf('<', script.end - 1);

	str.overwrite(script.start, scriptStartTagEnd, '</>;');
	str.overwrite(scriptEndTagStart, script.end, ';<>');
}
function resolveImplicitStores(
	htmlx: string,
	script: Node,
	implicitStoreValues: ImplicitStoreValues,
	str: MagicString
) {
	const scriptContent = htmlx.substring(script.content.start, script.content.end);
	const tsAst = ts.createSourceFile(
		'component.module.ts.svelte',
		scriptContent,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS
	);
	const astOffset = script.content.start;

	const walk = (node: ts.Node) => {
		if (ts.isVariableDeclaration(node)) {
			implicitStoreValues.addVariableDeclaration(node);
		}

		if (ts.isImportClause(node)) {
			implicitStoreValues.addImportStatement(node);
		}

		if (ts.isImportSpecifier(node)) {
			implicitStoreValues.addImportStatement(node);
		}

		ts.forEachChild(node, (n) => walk(n));
	};

	//walk the ast and convert to tsx as we go
	tsAst.forEachChild((n) => walk(n));

	// declare store declarations we found in the script
	implicitStoreValues.modifyCode(astOffset, str);
}
