import { decode } from "sourcemap-codec";
import { LineChar } from "./types";
type FileMapping = LineMapping[];
type LineMapping = CharacterMapping[]; // FileMapping[generated_line_index] = LineMapping
type CharacterMapping = [
	number, // generated character
	number, // original file
	number, // original line
	number, //  original index
];
type ReorderedChar = [original_character: number, generated_line: number, generated_character: number];
interface ReorderedMap {
	[original_line: number]: ReorderedChar[];
}
function binaryInsert(array: number[], value: number): void;
function binaryInsert<T extends Record<any, number> | number[]>(array: T[], value: T, key: keyof T): void;
function binaryInsert<A extends Record<any, number>[] | number[]>(array: A, value: A[any], key?: keyof (A[any] & object)) {
	if (0 === key) key = "0" as keyof A[any];
	const index = 1 + binarySearch(array, (key ? value[key] : value) as number, key);
	let i = array.length;
	while (index !== i--) array[1 + i] = array[i];
	array[index] = value;
}
function binarySearch<T extends object | number>(array: T[], target: number, key?: keyof (T & object)) {
	if (!array || 0 === array.length) return -1;
	if (0 === key) key = "0" as keyof T;
	let low = 0;
	let high = array.length - 1;
	while (low <= high) {
		const i = low + ((high - low) >> 1);
		const item = undefined === key ? array[i] : array[i][key];
		if (item === target) return i;
		if (item < target) low = i + 1;
		else high = i - 1;
	}
	if ((low = ~low) < 0) low = ~low - 1;
	return low;
}
export class SourceMapConsumer {
	private mappings: FileMapping;
	private reverseMappings?: ReorderedMap;
	private computeReversed() {
		this.reverseMappings = {} as ReorderedMap;
		for (let generated_line = 0; generated_line !== this.mappings.length; generated_line++) {
			for (const { 0: generated_index, 2: original_line, 3: original_character_index } of this.mappings[generated_line]) {
				const reordered_char: ReorderedChar = [original_character_index, generated_line, generated_index];
				if (original_line in this.reverseMappings) binaryInsert(this.reverseMappings[original_line], reordered_char, 0);
				else this.reverseMappings[original_line] = [reordered_char];
			}
		}
	}
	constructor(mappings: FileMapping | string) {
		if (typeof mappings === "string") this.mappings = decode(mappings) as FileMapping;
		else this.mappings = mappings;
	}
	getOriginalPosition(position: LineChar): LineChar {
		const lineMap = this.mappings[position.line];
		const closestMatch = binarySearch(lineMap, position.character, 0);
		const { 2: line, 3: character } = lineMap[closestMatch];
		return { line, character };
	}
	getGeneratedPosition(position: LineChar): LineChar {
		if (!this.reverseMappings) this.computeReversed();
		const lineMap = this.reverseMappings![position.line];
		const closestMatch = binarySearch(lineMap, position.character, 0);
		const { 1: line, 2: character } = lineMap[closestMatch];
		return { line, character };
	}
}
