type ChordSheetLibrary = typeof import('chordsheetjs');

export type Notation = 'symbol' | 'solfege' | 'number';

export interface SongPreview {
	markup: string;
	hasKey: boolean;
	error: string | null;
}

export function renderSongPreview(
	library: ChordSheetLibrary,
	content: string,
	notation: Notation,
	semitones: number
): SongPreview {
	let hasKey = false;
	try {
		let song = new library.ChordProParser().parse(content);
		hasKey = Boolean(song.key);
		song = song.transpose(semitones);

		if (!hasKey) {
			if (notation === 'number') {
				throw new Error('Nashville notation requires {key: ...}.');
			}

			// ChordSheetJS requires a key while formatting even absolute notation.
			// Convert absolute chords first, preserving their written accidentals.
			song = song.changeChords((chord) => {
				if (!chord.isChordSymbol() && !chord.isChordSolfege()) {
					throw new Error('A {key: ...} directive is required to convert relative chords.');
				}
				return notation === 'solfege' ? chord.toChordSolfege('C') : chord.toChordSymbol('C');
			});
		}

		song.metadata.set('chord_style', notation);
		return { markup: new library.HtmlDivFormatter().format(song), hasKey, error: null };
	} catch (cause) {
		return {
			markup: '',
			hasKey,
			error: cause instanceof Error ? cause.message : String(cause)
		};
	}
}
