import { TSPluginContext } from ".";
import { addSideEffects, override, quote, toLineChar } from "./utils";
export const debug = new (class Debug {
	constructor() {
		this.log("### PLUGIN SCRIPT EVALUATED ###");
	}
	enabled = true;
	readonly pluginName = "[TSPlugin_name_missing]";
	private directory = "";
	getFancyPluginName(...args: string[]) {
		return `TSPlugin<${this.pluginName}${args.length ? ", " + args.join(", ") : ""}>`;
	}
	throw(str: string) {
		if (!this.enabled) return;
		throw new Error(`${this.pluginName} Error: ${str}`);
	}
	private logger: ts.server.Logger = { info: console.log } as any;
	private allow_regexp = [
		/^Project \'.*?\' \(Configured\)$/,
		/^\tFiles ([0-9]+)\n\t/,
		/^Different program with same set of files:: structureIsReused:: [0-9]+$/,
		// /^Config: .*? : {\n \"rootNames\"/,
	];
	private custom_regexp: [RegExp, (str: string) => string | null][] = [
		[
			/^Config: .*? : {\n \"rootNames\"/,
			(str) => {
				const index = str.indexOf("{");
				const o: { rootNames: string[]; options: Record<string, any> } = JSON.parse(str.slice(index));
				o.rootNames = o.rootNames.map((str) => this.projectPath(str));
				if ("configFilePath" in o.options) {
					o.options.configFilePath = this.projectPath(o.options.configFilePath);
				}
				const path = str.slice("Config: ".length, index - 3);
				return `Config | "${path}"\n` + JSON.stringify(o, void 0, "\t");
			},
		],
		[
			/^event:\n    /,
			(str) => {
				const obj: { event: string; body: any } = JSON.parse(str.slice("event:\n    ".length));
				let text = "";
				x: {
					if (["syntaxDiag", "semanticDiag", "suggestionDiag"].includes(obj.event)) {
						const body = obj.body as { file: string; diagnostics: ts.DiagnosticWithLocation[] };
						if (body.diagnostics.length === 0) {
							text = ` | "${this.projectPath(body.file)}" -> (no results)`;
							break x;
						}
					}
					text = "\n" + JSON.stringify(obj.body, void 0, "\t");
					if (text.length < 150) text = `-> ${JSON.stringify(obj.body)}`;
				}
				return `Event | "${obj.event}"` + text;
			},
		],
		[
			/^request:\n    /,
			(str) => {
				const obj: { command: string; arguments: any; seq: number } = JSON.parse(str.slice("request:\n    ".length));
				let text = "";
				if (!obj.arguments) {
					text = "| (no arguments)";
				} else {
					text = "\n" + JSON.stringify(obj.arguments, void 0, "\t");
					if (text.length < 150 || text.length > 1000) {
						text = ` -> ${JSON.stringify(obj.arguments)}`;
					}
				}
				return `Request ${obj.seq} | "${obj.command}"` + text;
			},
		],
		[
			/^response:\n    /,
			(str) => {
				const obj: { command: string; success: boolean; body: any; request_seq: number } = JSON.parse(
					str.slice("response:\n    ".length),
				);
				let text = "";
				if (typeof obj.body !== "object") text = ` -> ${JSON.stringify(obj.body)}`;
				else if (obj.command === "getApplicableRefactors") {
					text = ` -> (${obj.body.length} results hidden)`;
				} else if (obj.command === "getSupportedCodeFixes") {
					text = " -> number[]";
				} else {
					text =
						"\n" +
						JSON.stringify(
							obj.body,
							function (key, value) {
								if (key === "file") return debug.projectPath(value);
								if (key === "start" || key === "end" || key === "contextStart" || key === "contextEnd")
									return JSON.stringify(value);
								return value;
							},
							"\t",
						).replace(/"{\\"line\\":([0-9]+),\\"offset\\":([0-9]+)}"/g, `{ "line":$1, "offset": $2}`);
				}
				return `Response ${obj.request_seq} | "${obj.command}"` + text + `\n${"-".repeat(30)}`;
			},
		],
		[
			/^Reloading configured project /,
			(str) => {
				const path = str.slice("Reloading configured project".length);
				return `Reloading configurated project at "${path}"`;
			},
		],
	];
	private suppress_regexp = [
		// project
		/^Search path: /, //
		/^For info: .*? :: Config file name: /,
		// plugins
		/^Loading global plugin /,
		/^Enabling plugin .*? from candidate paths: /,
		/^Loading .*? from .*? \(resolved to .*?\)$/,
		/^typescript-vscode-sh-plugin initialized/,
		/^Plugin validation succeded$/,
		// watcher
		/FileWatcher:: Added:: WatchInfo:/,
		/DirectoryWatcher:: Added:: WatchInfo:/,
		/^watchDirectory for .*? uses cached drive information\.$/,
		// graph
		/^Starting updateGraphWorker: Project: /,
		/^Finishing updateGraphWorker: Project: /,
		// on load/reload
		/^After ensureProjectForOpenFiles:$/,
		/^Before ensureProjectForOpenFiles:$/,
		/^ConfigFilePresence:: Current Watches: Config file:: File: /,
		/Open files: /,
		/^-----------------------------------------------$/,
		/^\tFileName: .*? ProjectRootPath: $/,
		/^\tFiles ([0-9]+)\n$/,
		// unsure
		/^Running: \*ensureProjectForOpenFiles\*$/,
	];
	private replace_regexp: [RegExp, string][] = [
		[/^reload projects\.$/, `### RELOADING PROJECTS ###`], //
	];
	private suppressLogs() {
		if (!this.enabled) return;
		this.log(`### SUPRESSING/REWRITING TS SERVER LOGS FROM TSPLUGIN "${this.pluginName}" ###`);
		override(this.logger, {
			msg: (_, str, type) => {
				x: if (!str.startsWith(this.pluginName) && type === "Info") {
					for (const re of this.allow_regexp) {
						if (re.test(str)) break x;
					}
					for (const [re, fn] of this.custom_regexp) {
						if (re.test(str)) {
							const r = fn(str);
							if (r === null) return;
							else return _(r, type);
						}
					}
					for (const [re, r] of this.replace_regexp) {
						if (re.test(str)) return _(r, type);
					}
					for (const re of this.suppress_regexp) {
						if (re.test(str)) return;
					}
					// if (/^\tFiles ([0-9]+)\n$/.test(str)) return;
					return _(JSON.stringify(str), type);
				} else if (type === "Perf") {
					if (/elapsed time \(in milliseconds\) [\.0-9]+$/.test(str)) {
						const t = parseFloat(str);
						if (t < 10) return;
					}
				}
				return _(str, type);
			},
		});
	}
	init(info: TSPluginContext) {
		// @ts-expect-error
		this.enabled = info.ts.server.findArgument("--logVerbosity") === "verbose";
		// @ts-expect-error
		this.pluginName = info.config.name;
		// @ts-expect-error
		this.directory = info.project.currentDirectory;
		this.logger = info.project.projectService.logger;
		if (this.enabled) {
			this.suppressLogs();
		}
		this.log(`### DEBUG ENABLED ###`);
		return this.enabled;
	}
	log(str: any) {
		if (!this.enabled) return;
		// if (str.includes("\n")) str = str.replace(/^\n*/, "\n\n").replace(/\n*$/, "\n");
		str = `${this.pluginName} | ${str}`;
		this.logger.info(str); // note: vscode does not support ANSI color in .log files
	}
	private plogs = new WeakMap<object, string>();
	logIfChanged(ref: object | undefined, str: string) {
		if (!this.enabled) return;
		if (!ref) {
			this.log(str);
			return;
		}
		if (this.plogs.get(ref) !== str) this.log(str);
		this.plogs.set(ref, str);
	}
	projectPath(str: string) {
		return str.replace(this.directory, "");
	}
	fileName(str: string) {
		return str.slice(str.lastIndexOf("/") + 1);
	}
	baseFileName(str: string) {
		return str.slice(str.lastIndexOf("/") + 1, str.lastIndexOf("."));
	}
	formatCall(objectName: string, methodName: string, ...args: string[]) {
		if (!this.enabled) return "";
		return `${objectName}.${methodName}(${args.join(", ")});`;
	}
	private stringify(arg: any) {
		if (typeof arg === "string") {
			if (/\n/.test(arg)) return `"..."`;
			return quote(arg);
		}
		if (typeof arg === "object") {
			if (arg.constructor === Object) {
				for (const key in arg) {
					const value = arg[key];
					switch (typeof value) {
						case "object":
						case "function":
							return "{...}";
					}
				}
				return `{ ${Object.keys(arg)
					.map((key) => `${key}: ${debug.stringify(arg[key])}`)
					.join(", ")} }`;
			}
			if (arg.constructor === Array) {
				for (const value of arg) {
					switch (typeof value) {
						case "object":
						case "function":
							return "[...]";
					}
				}
				return `[${arg.map(debug.stringify).join(", ")}]`;
			}
			return arg.constructor.name;
		}
		return "" + arg;
	}
	formatCallFull(objectName: string, methodName: string, args: any[], result?: any) {
		if (!this.enabled) return "";
		let str = args
			.map(this.stringify)
			.join(", ")
			.replace(/(, undefined)+$/, "");
		if (str.length > 100) str = str.slice(0, str.lastIndexOf(", ", 100)) + ", ...";
		return `${objectName}.${methodName}(${str}) -> ${this.stringify(result)}`;
	}
	everyCall(
		obj: object,
		config: {
			name: string;
			keys?: string[];
			ifFirstArg?(fileName: string): boolean;
			format?(objectName: string, methodName: string, args: any[], result?: any): string;
		},
	) {
		if (!this.enabled) return;
		const overrides = {};
		for (const key of config.keys ?? Object.keys(obj)) {
			// @ts-ignore
			if (typeof obj[key] !== "function") continue;
			if (config.ifFirstArg) {
				const format =
					config.format ??
					((on, mn, args, r) => this.formatCallFull(on, mn, [quote(this.projectPath(args[0])), ...args.slice(1)], r));
				// @ts-ignore
				overrides[key] = (result, fileName, ...args) => {
					if (typeof fileName === "string" && config.ifFirstArg(fileName)) {
						this.log(format(config.name, key, [fileName, ...args], result));
					}
				};
			} else {
				const format = config.format ?? this.formatCallFull.bind(this);
				// @ts-ignore
				overrides[key] = (result, ...args) => {
					this.log(format(config.name, key, args, result));
				};
			}
		}
		addSideEffects(obj, overrides);
	}
	logFileContent(id: object, info: string, language: string, text: string | undefined) {
		if (!this.enabled) return;
		let content = typeof text === "string" ? (text ? text : "<EmptyFile>") : "<FileNotFound>";
		this.logIfChanged(
			id,
			`${info}\n` + //
				`\`\`\`${language}\n` +
				`${content}\n` +
				`\`\`\``,
		);
	}
	compareMappings(context: TSPluginContext, a: ComparaisonMap, b: ComparaisonMap, maybeRangeEnd: boolean) {
		if (!this.enabled) return;
		const [left, right] = [parseMapping(context, a), parseMapping(context, b)];
		// todo better than 1char check
		if (left.lineContent[left.index] !== right.lineContent[right.index]) {
			if (maybeRangeEnd && left.lineContent[left.index - 1] === right.lineContent[right.index - 1]) {
				return;
			}
			this.log(`Mapping position mismatch\n` + mark(left) + mark(right));
			debugger;
			this.throw(`Mapping position mismatch`);
		}
	}
	trace(str: any) {
		if (!this.enabled) return;
		this.log(str);
		console.trace();
	}
})();
interface ComparaisonMap {
	text: string;
	position: { line: number; offset: number } | { line: number; character: number } | number;
	lineStarts?: number[];
	maybeRangeEndCorrected?: boolean;
}
interface MappedType {
	lineContent: string;
	lineNumber: number;
	index: number;
}
function parseMapping(context: TSPluginContext, m: ComparaisonMap): MappedType {
	let { text, position, lineStarts = context.ts.computeLineStarts(m.text) } = m;
	if (typeof position === "number") {
		position = context.ts.computeLineAndCharacterOfPosition(lineStarts, position);
	} else if ("offset" in position) {
		position = toLineChar(position);
	}
	const lineContent = text.slice(lineStarts[position.line], lineStarts[position.line + 1] ?? text.length);
	return { lineContent: lineContent, index: position.character, lineNumber: position.line + 1 };
}
function mark({ lineContent, index, lineNumber }: MappedType) {
	const x = `${lineNumber}:${index + 1} `;
	let str = lineContent.replace(/\t/g, " ");
	if (!str.endsWith("\n")) str += "\n";
	return `${x}` + lineContent.replace(/\t/g, " ") + " ".repeat(index + x.length) + "^" + "\n";
}
