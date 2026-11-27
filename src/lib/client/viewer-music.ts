import type { Song } from 'chordsheetjs';
import type { Notation } from '#lib/core/viewer-preferences.js';

type ChordSheetLibrary = typeof import('chordsheetjs');

export type { Notation } from '#lib/core/viewer-preferences.js';
export type AccidentalPreference = '#' | 'b';

export interface ViewerMusicConfig {
	accidental: AccidentalPreference;
}

export const defaultViewerMusicConfig: ViewerMusicConfig = { accidental: '#' };

export interface SongKey {
	pitchClass: number;
	minor: boolean;
}

const sharpNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const flatNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const solfegeNames = [
	'Do',
	'Do#',
	'Re',
	'Re#',
	'Mi',
	'Fa',
	'Fa#',
	'Sol',
	'Sol#',
	'La',
	'La#',
	'Si'
] as const;
const flatSolfegeNames = [
	'Do',
	'Reb',
	'Re',
	'Mib',
	'Mi',
	'Fa',
	'Solb',
	'Sol',
	'Lab',
	'La',
	'Sib',
	'Si'
] as const;
const naturalPitch = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as const;
const majorSteps = [0, 2, 4, 5, 7, 9, 11] as const;
const minorSteps = [0, 2, 3, 5, 7, 8, 10] as const;
const romanDegrees = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

const modulo = (value: number) => ((value % 12) + 12) % 12;

export function parseSongKey(value: string): SongKey | null {
	const match = /^([A-G])([#b♯♭]?)(m?)$/.exec(value.trim());
	if (!match) return null;
	const base = naturalPitch[match[1] as keyof typeof naturalPitch];
	const accidental =
		match[2] === '#' || match[2] === '♯' ? 1 : match[2] === 'b' || match[2] === '♭' ? -1 : 0;
	return { pitchClass: modulo(base + accidental), minor: match[3] === 'm' };
}

export function originalSongKey(library: ChordSheetLibrary, song: Song): SongKey | null {
	if (song.key) {
		const explicit = parseSongKey(song.key);
		if (explicit) return explicit;
	}
	for (const line of song.lines) {
		for (const item of line.items) {
			if (!(item instanceof library.ChordLyricsPair) || !item.chords) continue;
			try {
				const chord = library.Chord.parse(item.chords);
				if (!chord?.isChordSymbol() || !chord.root) continue;
				const inferred = parseSongKey(chord.root.toString());
				if (inferred) return inferred;
			} catch {
				// Skip annotations that cannot be interpreted as chords.
			}
		}
	}
	return null;
}

export function transposeSongKey(key: SongKey, semitones: number): SongKey {
	return { pitchClass: modulo(key.pitchClass + semitones), minor: key.minor };
}

export function offsetForTone(original: SongKey, targetPitchClass: number): number {
	const upward = modulo(targetPitchClass - original.pitchClass);
	return upward > 6 ? upward - 12 : upward;
}

export function symbolKeyName(
	key: SongKey,
	config: ViewerMusicConfig = defaultViewerMusicConfig
): string {
	const name = (config.accidental === '#' ? sharpNames : flatNames)[key.pitchClass];
	return `${name}${key.minor ? 'm' : ''}`;
}

export function toneLabel(
	key: SongKey,
	notation: Notation,
	config: ViewerMusicConfig = defaultViewerMusicConfig
): string {
	const symbol = symbolKeyName(key, config);
	const solfege = (config.accidental === '#' ? solfegeNames : flatSolfegeNames)[key.pitchClass];
	switch (notation) {
		case 'symbol':
			return symbol;
		case 'solfege':
			return `${solfege}${key.minor ? 'm' : ''}`;
		case 'special-solfege':
			return key.minor ? solfege.toLowerCase() : solfege.toUpperCase();
		case 'number':
			return `1${key.minor ? 'm' : ''}·${symbol}`;
		case 'roman':
			return `${key.minor ? 'i' : 'I'}·${symbol}`;
		case 'hidden':
			return `${solfege}${key.minor ? 'm' : ''}`;
	}
}

export function chromaticTones(
	original: SongKey,
	notation: Notation,
	config: ViewerMusicConfig = defaultViewerMusicConfig
): { offset: number; label: string }[] {
	return Array.from({ length: 12 }, (_, index) => {
		const offset = index - 5;
		return { offset, label: toneLabel(transposeSongKey(original, offset), notation, config) };
	});
}

function specialSolfege(value: string): string {
	return value
		.split('/')
		.map((part, index) => {
			const match = /^(Do|Re|Mi|Fa|Sol|La|Si)([#b]?)(m(?!aj))?(.*)$/.exec(part);
			if (!match) return part;
			const [, note, accidental, minor, suffix] = match;
			const root = minor && index === 0 ? note.toLowerCase() : note.toUpperCase();
			return `${root}${accidental}${suffix}`;
		})
		.join('/');
}

function minorDegree(
	pitchClass: number,
	key: SongKey,
	notation: 'number' | 'roman',
	minorChord: boolean,
	config: ViewerMusicConfig
): string {
	const interval = modulo(pitchClass - key.pitchClass);
	const steps: readonly number[] = key.minor ? minorSteps : majorSteps;
	let degree = steps.indexOf(interval);
	let accidental = '';
	if (degree < 0) {
		if (config.accidental === '#') {
			degree = steps.findIndex((step) => modulo(step + 1) === interval);
			accidental = '#';
		} else {
			degree = steps.findIndex((step) => modulo(step - 1) === interval);
			accidental = 'b';
		}
	}
	if (degree < 0) throw new Error('Cannot determine relative chord degree.');
	const name = notation === 'number' ? String(degree + 1) : romanDegrees[degree];
	return `${accidental}${notation === 'roman' && minorChord ? name.toLowerCase() : name}`;
}

function relativeMinorChord(
	library: ChordSheetLibrary,
	value: string,
	key: SongKey,
	notation: 'number' | 'roman',
	config: ViewerMusicConfig
): string {
	const chord = library.Chord.parse(value);
	if (!chord?.root) return value;
	const root = parseSongKey(chord.root.toString());
	if (!root) return value;
	const rootLabel = minorDegree(root.pitchClass, key, notation, chord.root.isMinor(), config);
	const suffix = chord.suffix ?? '';
	const shownSuffix =
		notation === 'roman' && chord.root.isMinor() ? suffix.replace(/^m(?!aj)/, '') : suffix;
	let bass = '';
	if (chord.bass) {
		const bassKey = parseSongKey(chord.bass.toString());
		if (bassKey) bass = `/${minorDegree(bassKey.pitchClass, key, notation, false, config)}`;
	}
	return `${rootLabel}${shownSuffix}${bass}`;
}

export function displayViewerChord(
	library: ChordSheetLibrary,
	value: string,
	notation: Notation,
	key: SongKey | null,
	config: ViewerMusicConfig = defaultViewerMusicConfig
): string {
	if (notation === 'hidden') return '';
	const chord = library.Chord.parse(value);
	if (!chord) return value;
	const reference = key ? symbolKeyName(key, config) : 'C';
	const symbol = chord.toChordSymbol(reference).useAccidental(config.accidental).normalize('C');
	if (notation === 'symbol') return symbol.toString();
	if (notation === 'solfege' || notation === 'special-solfege') {
		const solfege = symbol
			.toChordSolfege(reference)
			.useAccidental(config.accidental)
			.normalize('Do')
			.toString();
		return notation === 'special-solfege' ? specialSolfege(solfege) : solfege;
	}
	if (!key) return symbol.toString();
	if (key.minor) return relativeMinorChord(library, symbol.toString(), key, notation, config);
	return notation === 'number'
		? symbol.toNumeric(reference).toString()
		: symbol.toNumeral(reference).toString();
}
