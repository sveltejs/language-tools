import ts from 'typescript';
import { getLastLeadingDoc } from '../utils/tsAst';

export interface IExportedNames {
	has(name: string): boolean;
}

export class ExportedNames
	extends Map<
		string,
		{
			type?: string;
			identifierText?: string;
			required?: boolean;
			doc?: string;
		}
	>
	implements IExportedNames {
	/**
	 * Adds export to map
	 */
	addExport(
		name: ts.BindingName,
		target: ts.BindingName = null,
		type: ts.TypeNode = null,
		required = false
	): void {
		if (name.kind != ts.SyntaxKind.Identifier) {
			throw Error('export source kind not supported ' + name);
		}
		if (target && target.kind != ts.SyntaxKind.Identifier) {
			throw Error('export target kind not supported ' + target);
		}

		if (target) {
			this.set(name.text, {
				type: type?.getText(),
				identifierText: (target as ts.Identifier).text,
				required,
				doc: this.getDoc(target)
			});
		} else {
			this.set(name.text, {});
		}
	}

	private getDoc(target: ts.BindingName) {
		let doc = undefined;
		// Traverse `a` up to `export let a`
		const exportExpr = target?.parent?.parent?.parent;

		if (exportExpr) {
			doc = getLastLeadingDoc(exportExpr);
		}

		return doc;
	}

	/**
	 * Creates a string from the collected props
	 *
	 * @param isTsFile Whether this is a TypeScript file or not.
	 */
	createPropsStr(isTsFile: boolean) {
		const names = Array.from(this.entries());
		const dontAddTypeDef =
			!isTsFile ||
			names.length === 0 ||
			names.every(([_, value]) => !value.type && value.required);

		const returnElements = names.map(([key, value]) => {
			// Important to not use shorthand props for rename functionality
			return `${dontAddTypeDef && value.doc ? `\n${value.doc}` : ''}${
				value.identifierText || key
			}: ${key}`;
		});

		if (dontAddTypeDef) {
			// No exports or only `typeof` exports -> omit the `as {...}` completely.
			// If not TS, omit the types to not have a "cannot use types in jsx" error.
			return `{${returnElements.join(' , ')}}`;
		}

		const returnElementsType = names.map(([key, value]) => {
			const identifier = `${value.doc ? `\n${value.doc}` : ''}${value.identifierText || key}${
				value.required ? '' : '?'
			}`;
			if (!value.type) {
				return `${identifier}: typeof ${key}`;
			}

			return `${identifier}: ${value.type}`;
		});

		return `{${returnElements.join(' , ')}} as {${returnElementsType.join(', ')}}`;
	}
}
