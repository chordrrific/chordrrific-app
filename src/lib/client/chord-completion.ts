import { environmentIdentity, scanDirectives } from './chordpro-language.js';

export type ChordNotation = 'symbol' | 'solfege';

export interface ChordCompletionConfig {
	primaryNotation: ChordNotation;
	showAlternative: boolean;
	qualities: readonly string[];
}

export const defaultChordCompletionConfig: ChordCompletionConfig = {
	primaryNotation: 'symbol',
	showAlternative: true,
	qualities: ['', 'm', '7', 'm7', 'maj7', 'dim', 'aug', 'sus2', 'sus4', '6', '9', 'add9']
};

interface NoteNames {
	symbol: string;
	solfege: string;
}

const naturalNotes: readonly NoteNames[] = [
	{ symbol: 'C', solfege: 'Do' },
	{ symbol: 'D', solfege: 'Re' },
	{ symbol: 'E', solfege: 'Mi' },
	{ symbol: 'F', solfege: 'Fa' },
	{ symbol: 'G', solfege: 'Sol' },
	{ symbol: 'A', solfege: 'La' },
	{ symbol: 'B', solfege: 'Si' }
];

const notes: readonly NoteNames[] = [
	...naturalNotes,
	...naturalNotes.map((note) => ({ symbol: `${note.symbol}#`, solfege: `${note.solfege}#` })),
	...naturalNotes.map((note) => ({ symbol: `${note.symbol}b`, solfege: `${note.solfege}b` }))
];

export interface ChordSuggestion {
	label: string;
	value: string;
}

function normalize(value: string): string {
	return value.toLocaleLowerCase().replaceAll('♯', '#').replaceAll('♭', 'b');
}

export function chordSuggestions(
	query: string,
	config: ChordCompletionConfig = defaultChordCompletionConfig
): ChordSuggestion[] {
	const prefix = normalize(query);
	const qualities = prefix ? config.qualities : [''];
	const suggestions: ChordSuggestion[] = [];
	for (const note of notes) {
		for (const quality of qualities) {
			const symbol = `${note.symbol}${quality}`;
			const solfege = `${note.solfege}${quality}`;
			if (prefix && !normalize(symbol).startsWith(prefix) && !normalize(solfege).startsWith(prefix))
				continue;
			const primary = config.primaryNotation === 'symbol' ? symbol : solfege;
			const alternative = config.primaryNotation === 'symbol' ? solfege : symbol;
			suggestions.push({
				label: config.showAlternative ? `${primary} / ${alternative}` : primary,
				value: primary
			});
		}
	}
	return suggestions;
}

export interface ChordCompletionContext {
	from: number;
	query: string;
}

const rawEnvironments = new Set(['tab', 'abc', 'ly', 'svg', 'textblock']);

export function chordCompletionContext(
	content: string,
	position: number
): ChordCompletionContext | null {
	if (position < 0 || position > content.length) return null;
	const lineStart = content.lastIndexOf('\n', Math.max(0, position - 1)) + 1;
	const before = content.slice(lineStart, position);
	const bracket = before.lastIndexOf('[');
	if (bracket < 0 || before.slice(bracket + 1).includes(']')) return null;
	const from = lineStart + bracket;
	let slashes = 0;
	for (let index = from - 1; index >= 0 && content[index] === '\\'; index -= 1) slashes += 1;
	if (slashes % 2 === 1) return null;
	const query = before.slice(bracket + 1);
	if (!/^[\p{L}\p{N}#♯♭+()/-]*$/u.test(query)) return null;

	let rawEnvironment: string | null = null;
	for (const token of scanDirectives(content)) {
		if (from >= token.from && from < token.to) return null;
		if (token.from >= from) break;
		const environment = environmentIdentity(token.name);
		if (!environment) continue;
		if (environment.kind === 'start' && rawEnvironments.has(environment.name)) {
			rawEnvironment = environment.name;
		} else if (environment.kind === 'end' && environment.name === rawEnvironment) {
			rawEnvironment = null;
		}
	}
	return rawEnvironment ? null : { from, query };
}

export function chordReplacement(
	content: string,
	position: number,
	context: ChordCompletionContext,
	chord: string
): { from: number; to: number; text: string; cursor: number } {
	const lineEnd = content.indexOf('\n', position);
	const remaining = content.slice(position, lineEnd < 0 ? content.length : lineEnd);
	const close = remaining.indexOf(']');
	const to =
		close >= 0 && /^[\p{L}\p{N}#♯♭+()/-]*$/u.test(remaining.slice(0, close))
			? position + close + 1
			: position;
	const text = `[${chord}]`;
	return { from: context.from, to, text, cursor: context.from + text.length };
}
