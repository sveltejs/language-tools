import type ts from "typescript/lib/tsserverlibrary";

declare namespace tsInternalHelpers {
	export function pathIsRelative(path: string): boolean;
	export function normalizeSlashes(path: string): string;
	export function normalizePath(path: string): string;
	export function getDirectoryPath(path: string): string;
	export function resolvePath(path: string, ...paths: (string | undefined)[]): string;
	export function computeLineStarts(text: string): number[];
	export function computeLineAndCharacterOfPosition(lineStarts: readonly number[], position: number): ts.LineAndCharacter;
	export function computePositionOfLineAndCharacter(
		lineStarts: readonly number[],
		line: number,
		character: number,
		debugText?: string,
		allowEdits?: true,
	): number;
}
// @ts-expect-error
interface tsInternalProjectService extends ts.server.ProjectService {
	filenameToScriptInfo: Map<string, ts.server.ScriptInfo>;
	hostConfiguration: ts.server.HostConfiguration;
}
export type LineOffset = ts.server.protocol.Location;
export type LineChar = ts.LineAndCharacter;

declare namespace tsInternalServerHelpers {
	export class ScriptVersionCache {
		edit(pos: number, deleteLen: number, insertedText?: string): void;
		getSnapshot(): ts.IScriptSnapshot;
		_getSnapshot(): ts.IScriptSnapshot;
		getSnapshotVersion(): number;
		getAbsolutePositionAndLineText(oneBasedLine: number): { absolutePosition: number; lineText: string | undefined };
		lineOffsetToPosition(line: number, column: number): number;
		positionToLineOffset(position: number): ts.server.protocol.Location;
		lineToTextSpan(line: number): ts.TextSpan;
		getTextChangesBetweenVersions(oldVersion: number, newVersion: number): ts.TextChangeRange | undefined;
		getLineCount(): number[];
		static fromString(script: string): ScriptVersionCache;
	}
	export class TextStorage {
		version: { svc: number; text: number };
		svc: ScriptVersionCache | undefined;
		text: string | undefined;
		lineMap: number[] | undefined;
		fileSize: number | undefined;
		isOpen: boolean;
		ownFileText: boolean;
		pendingReloadFromDisk: boolean;
		host: ts.server.ServerHost;
		info: ts.server.ScriptInfo;
		getVersion(): string;
		resetSourceMapInfo(): void;
		edit(start: number, end: number, newText: string): void;
		/**
		 *
		 * original -> transformed
		 * @param newText
		 */
		reload(newText: string): boolean;
		reloadWithFileText(tempFileName?: string): string;
		reloadFromDisk(): void;
		delayReloadFromFileIntoText(): void;
		getTelemetryFileSize(): number;
		getSnapshot(): ts.IScriptSnapshot;
		getAbsolutePositionAndLineText(line: number): { absolutePosition: number; lineText: string | undefined };
		/**
		 * Used on "getReferences" at "Typescript@4.3.0\src\server\session.ts:3111"
		 * Overriding this method is not enough as it will query text based on a transformed snapshot (see ^:3112)
		 *
		 * transformed -> transformed
		 * @param line starts at 0
		 */
		lineToTextSpan(line: number): ts.TextSpan;
		/**
		 * Used on "updateOpen" to get edit positions for cached versions
		 *
		 * original -> transformed
		 * @param line starts at 1
		 * @param offset starts at 1
		 * @param allowEdits
		 */
		lineOffsetToPosition(line: number, offset: number, allowEdits?: true): number;
		/**
		 * Used to map results to positions ("findRenameLocations", "findReferences", etc...)
		 *
		 * transformed -> original
		 * @param position
		 */
		positionToLineOffset(position: number): LineOffset;
		getFileTextAndSize(tempFileName?: string): { text: string; fileSize?: number };
		switchToScriptVersionCache(): ScriptVersionCache;
		useText(newText?: string): void;
		useScriptVersionCacheIfValidOrOpen(): ScriptVersionCache | undefined;
		getOrLoadText(): string;
		getLineMap(): number[];
		getLineInfo(): number[];
	}
}
export type _ts = typeof ts & typeof tsInternalHelpers & { server: typeof tsInternalServerHelpers };
export { tsInternalHelpers as tsInternal, tsInternalServerHelpers };

