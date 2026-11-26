type ChordSheetLibrary = typeof import('chordsheetjs');
import {
	defaultViewerMusicConfig,
	displayViewerChord,
	originalSongKey,
	transposeSongKey,
	type SongKey,
	type ViewerMusicConfig
} from './viewer-music.js';

export type { Notation } from './viewer-music.js';
import type { Notation } from './viewer-music.js';
export type ChorusMode = 'label' | 'expanded' | 'hidden';

export interface PreviewSegment {
	chord: string;
	lyrics: string;
}

export interface PreviewLine {
	kind: 'line';
	segments: PreviewSegment[];
	hasChords: boolean;
	comment?: boolean;
}

export interface BisDisplayConfig {
	defaultMarker: string;
	repeatMarkerTemplate: string;
}

export const defaultBisDisplayConfig: BisDisplayConfig = {
	defaultMarker: '(bis)',
	repeatMarkerTemplate: '(x{count})'
};

export interface PreviewBis {
	kind: 'bis';
	parts: PreviewPart[];
	repeat: number | null;
	label: string | null;
	marker: string;
}

export type PreviewPart = PreviewLine | PreviewBis;

type SectionKind = 'plain' | 'verse' | 'chorus';

interface SectionBlock {
	kind: 'section';
	section: SectionKind;
	parts: PreviewPart[];
	label: string | null;
	sourceIndex: number;
	recalled: boolean;
	targetSourceIndex?: number;
}

interface ChorusReference {
	kind: 'chorus-reference';
	label: string | null;
	sourceIndex: number;
}

interface CommentBlock {
	kind: 'comment';
	text: string;
}

type SourceBlock = SectionBlock | ChorusReference | CommentBlock;
export type PreviewBlock =
	| SectionBlock
	| CommentBlock
	| { kind: 'chorus-label'; sourceIndex: number; targetSourceIndex: number }
	| { kind: 'missing-chorus'; label: string | null };

export interface SongPreview {
	title: string | null;
	blocks: PreviewBlock[];
	hasKey: boolean;
	hasChords: boolean;
	hasChorusReferences: boolean;
	originalKey: SongKey | null;
	currentKey: SongKey | null;
	error: string | null;
}

function displayParts(
	library: ChordSheetLibrary,
	parts: PreviewPart[],
	notation: Notation,
	key: SongKey | null,
	musicDisplay: ViewerMusicConfig
): PreviewPart[] {
	return parts.map((part) =>
		part.kind === 'line'
			? {
					...part,
					segments: part.segments.map((segment) => ({
						...segment,
						chord: segment.chord
							? displayViewerChord(library, segment.chord, notation, key, musicDisplay)
							: ''
					}))
				}
			: { ...part, parts: displayParts(library, part.parts, notation, key, musicDisplay) }
	);
}

function collectBlocks(
	library: ChordSheetLibrary,
	song: import('chordsheetjs').Song,
	bisDisplay: BisDisplayConfig
): SourceBlock[] {
	const blocks: SourceBlock[] = [];
	let current: SectionBlock | null = null;
	const bisStack: PreviewBis[] = [];

	function flush() {
		if (bisStack.length > 0) throw new Error('Missing {x_end_of_bis} directive.');
		if (current && (current.parts.length > 0 || current.section === 'chorus')) blocks.push(current);
		current = null;
	}

	for (const [sourceIndex, line] of song.lines.entries()) {
		const directive = line.items.find((item) => item instanceof library.Tag);
		if (directive instanceof library.Tag) {
			if (directive.name === 'start_of_chorus' || directive.name === 'start_of_verse') {
				flush();
				current = {
					kind: 'section',
					section: directive.name === 'start_of_chorus' ? 'chorus' : 'verse',
					parts: [],
					label: directive.label.trim() || null,
					sourceIndex,
					recalled: false
				};
				continue;
			}
			if (directive.name === 'end_of_chorus' || directive.name === 'end_of_verse') {
				flush();
				continue;
			}
			if (directive.name === 'x_start_of_bis') {
				if (bisStack.length >= 2) {
					throw new Error('{x_start_of_bis} supports at most two nested levels.');
				}
				if (!current) {
					current = {
						kind: 'section',
						section: 'plain',
						parts: [],
						label: null,
						sourceIndex,
						recalled: false
					};
				}
				const rawRepeat = directive.attributes.repeat?.trim();
				let repeat: number | null = null;
				if (rawRepeat !== undefined) {
					repeat = Number(rawRepeat);
					if (!/^\d+$/.test(rawRepeat) || !Number.isSafeInteger(repeat) || repeat < 1) {
						throw new Error('The repeat attribute of {x_start_of_bis} must be a positive integer.');
					}
				}
				const bis: PreviewBis = {
					kind: 'bis',
					parts: [],
					repeat,
					label: directive.attributes.label ?? null,
					marker:
						repeat === null
							? bisDisplay.defaultMarker
							: bisDisplay.repeatMarkerTemplate.replaceAll('{count}', String(repeat))
				};
				const parent = bisStack.at(-1);
				if (parent) parent.parts.push(bis);
				else current.parts.push(bis);
				bisStack.push(bis);
				continue;
			}
			if (directive.name === 'x_end_of_bis') {
				if (bisStack.length === 0) throw new Error('Unexpected {x_end_of_bis} directive.');
				bisStack.pop();
				continue;
			}
			if (directive.name.startsWith('x_')) continue;
			if (directive.name === 'chorus') {
				flush();
				blocks.push({
					kind: 'chorus-reference',
					label: directive.label.trim() || null,
					sourceIndex
				});
				continue;
			}
			if (directive.isComment()) {
				if (bisStack.length > 0 || current) {
					const comment: PreviewLine = {
						kind: 'line',
						segments: [{ chord: '', lyrics: directive.value }],
						hasChords: false,
						comment: true
					};
					if (bisStack.length > 0) bisStack.at(-1)!.parts.push(comment);
					else current?.parts.push(comment);
				} else {
					blocks.push({ kind: 'comment', text: directive.value });
				}
				continue;
			}
		}

		const segments: PreviewSegment[] = [];
		for (const item of line.items) {
			if (item instanceof library.ChordLyricsPair) {
				segments.push({ chord: item.chords, lyrics: item.lyrics ?? '' });
			} else if (item instanceof library.Literal) {
				segments.push({ chord: '', lyrics: item.string });
			}
		}
		if (segments.length === 0) {
			const blank: PreviewLine = {
				kind: 'line',
				segments: [{ chord: '', lyrics: '' }],
				hasChords: false
			};
			if (bisStack.length > 0) bisStack.at(-1)!.parts.push(blank);
			else if (current?.section === 'plain') flush();
			else current?.parts.push(blank);
			continue;
		}
		if (!current) {
			current = {
				kind: 'section',
				section: 'plain',
				parts: [],
				label: null,
				sourceIndex,
				recalled: false
			};
		}
		const previewLine: PreviewLine = {
			kind: 'line',
			segments,
			hasChords: segments.some((segment) => Boolean(segment.chord))
		};
		if (bisStack.length > 0) bisStack.at(-1)!.parts.push(previewLine);
		else current.parts.push(previewLine);
	}
	flush();
	return blocks;
}

function resolveChorus(
	reference: ChorusReference,
	choruses: SectionBlock[]
): SectionBlock | undefined {
	const matches = reference.label
		? choruses.filter((chorus) => chorus.label === reference.label)
		: choruses;
	const previous = matches.filter((chorus) => chorus.sourceIndex < reference.sourceIndex);
	return previous.at(-1) ?? (reference.label ? matches[0] : undefined);
}

function displayBlocks(
	source: SourceBlock[],
	mode: ChorusMode,
	referenceModes: Readonly<Record<number, ChorusMode>>
): PreviewBlock[] {
	const choruses = source.filter(
		(block): block is SectionBlock => block.kind === 'section' && block.section === 'chorus'
	);
	return source.flatMap((block): PreviewBlock[] => {
		if (block.kind !== 'chorus-reference') return [block];
		const displayMode = referenceModes[block.sourceIndex] ?? mode;
		if (displayMode === 'hidden') return [];
		const target = resolveChorus(block, choruses);
		if (!target) return [{ kind: 'missing-chorus', label: block.label }];
		if (displayMode === 'label') {
			return [
				{
					kind: 'chorus-label',
					sourceIndex: block.sourceIndex,
					targetSourceIndex: target.sourceIndex
				}
			];
		}
		return [
			{
				...target,
				sourceIndex: block.sourceIndex,
				recalled: true,
				targetSourceIndex: target.sourceIndex
			}
		];
	});
}

export function renderSongPreview(
	library: ChordSheetLibrary,
	content: string,
	notation: Notation,
	semitones: number,
	chorusMode: ChorusMode = 'label',
	bisDisplay: BisDisplayConfig = defaultBisDisplayConfig,
	referenceModes: Readonly<Record<number, ChorusMode>> = {},
	musicDisplay: ViewerMusicConfig = defaultViewerMusicConfig
): SongPreview {
	let hasKey = false;
	let hasChords = false;
	let hasChorusReferences = false;
	let originalKey: SongKey | null = null;
	let currentKey: SongKey | null = null;
	try {
		let song = new library.ChordProParser().parse(content);
		hasKey = Boolean(song.key);
		hasChords = song.lines.some((line) =>
			line.items.some((item) => item instanceof library.ChordLyricsPair && Boolean(item.chords))
		);
		originalKey = originalSongKey(library, song);
		currentKey = originalKey ? transposeSongKey(originalKey, semitones) : null;
		song = song.transpose(semitones, { accidental: musicDisplay.accidental });
		const source = collectBlocks(library, song, bisDisplay).map((block): SourceBlock =>
			block.kind === 'section'
				? {
						...block,
						parts: displayParts(library, block.parts, notation, currentKey, musicDisplay)
					}
				: block
		);
		hasChorusReferences = source.some((block) => block.kind === 'chorus-reference');

		return {
			title: song.getSingleMetadataValue('title'),
			blocks: displayBlocks(source, chorusMode, referenceModes),
			hasKey,
			hasChords,
			hasChorusReferences,
			originalKey,
			currentKey,
			error: null
		};
	} catch (cause) {
		return {
			title: null,
			blocks: [],
			hasKey,
			hasChords,
			hasChorusReferences,
			originalKey,
			currentKey,
			error: cause instanceof Error ? cause.message : String(cause)
		};
	}
}
