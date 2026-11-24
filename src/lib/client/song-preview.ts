type ChordSheetLibrary = typeof import('chordsheetjs');

export type Notation = 'symbol' | 'solfege' | 'number';
export type ChorusMode = 'label' | 'expanded';

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
	lines: PreviewLine[];
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
	| { kind: 'chorus-label' }
	| { kind: 'missing-chorus'; label: string | null };

export interface SongPreview {
	title: string | null;
	blocks: PreviewBlock[];
	hasKey: boolean;
	error: string | null;
}

function collectBlocks(
	library: ChordSheetLibrary,
	song: import('chordsheetjs').Song,
	bisDisplay: BisDisplayConfig
): SourceBlock[] {
	const blocks: SourceBlock[] = [];
	let current: SectionBlock | null = null;
	let activeBis: PreviewBis | null = null;

	function flush() {
		if (activeBis) throw new Error('Missing {x_end_of_bis} directive.');
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
				if (activeBis) throw new Error('Nested {x_start_of_bis} directives are not supported.');
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
				activeBis = {
					kind: 'bis',
					lines: [],
					repeat,
					label: directive.attributes.label ?? null,
					marker:
						repeat === null
							? bisDisplay.defaultMarker
							: bisDisplay.repeatMarkerTemplate.replaceAll('{count}', String(repeat))
				};
				current.parts.push(activeBis);
				continue;
			}
			if (directive.name === 'x_end_of_bis') {
				if (!activeBis) throw new Error('Unexpected {x_end_of_bis} directive.');
				activeBis = null;
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
				if (activeBis || current) {
					const comment: PreviewLine = {
						kind: 'line',
						segments: [{ chord: '', lyrics: directive.value }],
						hasChords: false,
						comment: true
					};
					if (activeBis) activeBis.lines.push(comment);
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
			if (activeBis) activeBis.lines.push(blank);
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
		if (activeBis) activeBis.lines.push(previewLine);
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

function displayBlocks(source: SourceBlock[], mode: ChorusMode): PreviewBlock[] {
	const choruses = source.filter(
		(block): block is SectionBlock => block.kind === 'section' && block.section === 'chorus'
	);
	return source.map((block): PreviewBlock => {
		if (block.kind !== 'chorus-reference') return block;
		if (mode === 'label') return { kind: 'chorus-label' };
		const target = resolveChorus(block, choruses);
		return target
			? { ...target, sourceIndex: block.sourceIndex, recalled: true }
			: { kind: 'missing-chorus', label: block.label };
	});
}

export function renderSongPreview(
	library: ChordSheetLibrary,
	content: string,
	notation: Notation,
	semitones: number,
	chorusMode: ChorusMode = 'label',
	bisDisplay: BisDisplayConfig = defaultBisDisplayConfig
): SongPreview {
	let hasKey = false;
	try {
		let song = new library.ChordProParser().parse(content);
		hasKey = Boolean(song.key);
		song = song.transpose(semitones);
		if (!hasKey && notation === 'number') {
			throw new Error('Nashville notation requires {key: ...}.');
		}

		const key = song.key ?? 'C';
		song = song.changeChords((chord) => {
			if (!hasKey && !chord.isChordSymbol() && !chord.isChordSolfege()) {
				throw new Error('A {key: ...} directive is required to convert relative chords.');
			}
			switch (notation) {
				case 'symbol':
					return chord.toChordSymbol(key);
				case 'solfege':
					return chord.toChordSolfege(key);
				case 'number':
					return chord.toNumeric(key);
			}
		});

		return {
			title: song.getSingleMetadataValue('title'),
			blocks: displayBlocks(collectBlocks(library, song, bisDisplay), chorusMode),
			hasKey,
			error: null
		};
	} catch (cause) {
		return {
			title: null,
			blocks: [],
			hasKey,
			error: cause instanceof Error ? cause.message : String(cause)
		};
	}
}
