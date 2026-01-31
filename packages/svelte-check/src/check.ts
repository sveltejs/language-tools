import * as kit from '@volar/kit';
import { Diagnostic, DiagnosticSeverity } from '@volar/kit';
import * as fg from 'fast-glob';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { svelteLanguagePlugin } from 'svelte-language-server/out/languagePlugin.js';
import { create as createTypeScriptServicePlugins } from 'volar-service-typescript';

// Export those for downstream consumers
export { Diagnostic, DiagnosticSeverity };

export interface CheckResult {
	status: 'completed' | 'cancelled' | undefined;
	fileChecked: number;
	errors: number;
	warnings: number;
	hints: number;
	fileResult: {
		errors: kit.Diagnostic[];
		fileUrl: URL;
		fileContent: string;
		text: string;
	}[];
}

export class SvelteCheck {
	private ts!: typeof import('typescript/lib/tsserverlibrary.js');
	public linter!: ReturnType<(typeof kit)['createTypeScriptChecker']>;

	constructor(
		private readonly workspacePath: string,
		private readonly typescriptPath: string | undefined,
		private readonly tsconfigPath: string | undefined
	) {
		this.initialize();
	}

	/**
	 * Lint a list of files or the entire project and optionally log the errors found
	 * @param fileNames List of files to lint, if undefined, all files included in the project will be linted
	 * @param logErrors Whether to log errors by itself. This is disabled by default.
	 * @return {CheckResult} The result of the lint, including a list of errors, the file's content and its file path.
	 */
	public async lint({
		fileNames = undefined,
		cancel = () => false,
		logErrors = undefined,
	}: {
		fileNames?: string[] | undefined;
		cancel?: () => boolean;
		logErrors?:
		| {
			level: 'error' | 'warning' | 'hint';
		}
		| undefined;
	}): Promise<CheckResult> {
		const files =
			fileNames !== undefined ? fileNames : this.linter.projectHost.getScriptFileNames();

		const result: CheckResult = {
			status: undefined,
			fileChecked: 0,
			errors: 0,
			warnings: 0,
			hints: 0,
			fileResult: [],
		};
		for (const file of files) {
			if (cancel()) {
				result.status = 'cancelled';
				return result;
			}
			const fileDiagnostics = await this.linter.check(file);

			// Filter diagnostics based on the logErrors level
			const fileDiagnosticsToPrint = fileDiagnostics.filter((diag) => {
				const severity = diag.severity ?? 1 satisfies typeof DiagnosticSeverity.Error;
				switch (logErrors?.level ?? 'hint') {
					case 'error':
						return severity <= (1 satisfies typeof DiagnosticSeverity.Error);
					case 'warning':
						return severity <= (2 satisfies typeof DiagnosticSeverity.Warning);
					case 'hint':
						return severity <= (4 satisfies typeof DiagnosticSeverity.Hint);
				}
			});

			if (fileDiagnostics.length > 0) {
				const errorText = this.linter.printErrors(file, fileDiagnosticsToPrint);

				if (logErrors !== undefined && errorText) {
					console.info(errorText);
				}

				const fileSnapshot = this.linter.projectHost.getScriptSnapshot(file);
				const fileContent = fileSnapshot?.getText(0, fileSnapshot.getLength());

				result.fileResult.push({
					errors: fileDiagnostics,
					fileContent: fileContent ?? '',
					fileUrl: pathToFileURL(file),
					text: errorText,
				});

				result.errors += fileDiagnostics.filter(
					(diag) => diag.severity === (1 satisfies typeof DiagnosticSeverity.Error)
				).length;
				result.warnings += fileDiagnostics.filter(
					(diag) => diag.severity === (2 satisfies typeof DiagnosticSeverity.Warning)
				).length;
				result.hints += fileDiagnostics.filter(
					(diag) => diag.severity === (4 satisfies typeof DiagnosticSeverity.Hint)
				).length;
			}

			result.fileChecked += 1;
		}

		result.status = 'completed';
		return result;
	}

	private initialize() {
		this.ts = this.typescriptPath ? require(this.typescriptPath) : require('typescript');
		const tsconfigPath = this.getTsconfig();

		const languagePlugins = [svelteLanguagePlugin];
		const languageServicePlugins = createTypeScriptServicePlugins(this.ts);

		if (tsconfigPath) {
			this.linter = kit.createTypeScriptChecker(languagePlugins, languageServicePlugins, tsconfigPath);
		} else {
			this.linter = kit.createTypeScriptInferredChecker(languagePlugins, languageServicePlugins, () => {
				return fg.sync('**/*.svelte', {
					cwd: this.workspacePath,
					ignore: ['node_modules'],
					absolute: true,
				});
			});
		}
	}

	private getTsconfig() {
		if (this.tsconfigPath) {
			if (!existsSync(this.tsconfigPath)) {
				throw new Error(`Specified tsconfig file \`${this.tsconfigPath}\` does not exist.`);
			}

			return this.tsconfigPath;
		}

		const searchPath = this.workspacePath;

		const tsconfig =
			this.ts.findConfigFile(searchPath, this.ts.sys.fileExists) ||
			this.ts.findConfigFile(searchPath, this.ts.sys.fileExists, 'jsconfig.json');

		return tsconfig;
	}
}
