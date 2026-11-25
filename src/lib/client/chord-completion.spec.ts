import { describe, expect, it } from 'vitest';
import {
	chordCompletionContext,
	chordReplacement,
	chordSuggestions,
	defaultChordCompletionConfig
} from './chord-completion.js';

describe('Chord completion', () => {
	it('matches solfege while displaying and inserting English notation by default', () => {
		expect(chordSuggestions('sol')[0]).toEqual({ label: 'G / Sol', value: 'G' });
		expect(chordSuggestions('sib')[0]).toEqual({ label: 'Bb / Sib', value: 'Bb' });
		expect(chordSuggestions('Gm7')[0]).toEqual({ label: 'Gm7 / Solm7', value: 'Gm7' });
		expect(chordSuggestions('')).toHaveLength(21);
	});

	it('allows the primary notation and secondary label to be changed without a UI', () => {
		const solfege = { ...defaultChordCompletionConfig, primaryNotation: 'solfege' as const };
		expect(chordSuggestions('sol', solfege)[0]).toEqual({ label: 'Sol / G', value: 'Sol' });
		expect(chordSuggestions('sol', { ...solfege, showAlternative: false })[0]).toEqual({
			label: 'Sol',
			value: 'Sol'
		});
	});

	it('completes only lyric chords, not directives, escaped brackets or raw environments', () => {
		const lyrics = '{start_of_verse}\nLa [sol';
		expect(chordCompletionContext(lyrics, lyrics.length)).toEqual({
			from: lyrics.indexOf('['),
			query: 'sol'
		});
		expect(chordCompletionContext('{comment: [sol', '{comment: [sol'.length)).toBeNull();
		expect(
			chordCompletionContext('{start_of_abc}\n[sol', '{start_of_abc}\n[sol'.length)
		).toBeNull();
		expect(
			chordCompletionContext('{start_of_svg}\n[sol', '{start_of_svg}\n[sol'.length)
		).toBeNull();
		expect(chordCompletionContext('\\[sol', '\\[sol'.length)).toBeNull();
		expect(chordCompletionContext('[*Coda', '[*Coda'.length)).toBeNull();
		expect(chordCompletionContext('[G] word', '[G] word'.length)).toBeNull();
	});

	it('adds one closing bracket and preserves lyrics after the chord', () => {
		const incomplete = 'La [sol';
		const incompleteContext = chordCompletionContext(incomplete, incomplete.length)!;
		const edit = chordReplacement(incomplete, incomplete.length, incompleteContext, 'G');
		expect(incomplete.slice(0, edit.from) + edit.text + incomplete.slice(edit.to)).toBe('La [G]');
		expect(edit.cursor).toBe('La [G]'.length);

		const existing = 'La [sol] palabra';
		const position = existing.indexOf(']');
		const context = chordCompletionContext(existing, position)!;
		const replacement = chordReplacement(existing, position, context, 'G');
		expect(
			existing.slice(0, replacement.from) + replacement.text + existing.slice(replacement.to)
		).toBe('La [G] palabra');
	});
});
