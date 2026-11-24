import * as library from 'chordsheetjs';
import { describe, expect, it } from 'vitest';
import { renderSongPreview, type PreviewBlock, type SongPreview } from './song-preview.js';

type Section = Extract<PreviewBlock, { kind: 'section' }>;

function sections(preview: SongPreview): Section[] {
	return preview.blocks.filter((block): block is Section => block.kind === 'section');
}

function lyrics(section: Section): string {
	return section.lines
		.map((line) => line.segments.map((segment) => segment.lyrics).join(''))
		.join('\n');
}

function chords(section: Section): string[] {
	return section.lines.flatMap((line) =>
		line.segments.map((segment) => segment.chord).filter(Boolean)
	);
}

describe('song preview', () => {
	it('renders absolute solfege without a key and preserves written accidentals', () => {
		const preview = renderSongPreview(library, '[C]Do [F#]Fa [Bb]Si', 'solfege', 0);
		expect(preview.error).toBeNull();
		expect(preview.hasKey).toBe(false);
		expect(chords(sections(preview)[0])).toEqual(['Do', 'Fa#', 'Sib']);
	});

	it('converts solfege source chords to symbols without a key', () => {
		const preview = renderSongPreview(library, '[Do]Hola [Fa]mundo', 'symbol', 0);
		expect(preview.error).toBeNull();
		expect(chords(sections(preview)[0])).toEqual(['C', 'F']);
	});

	it('keeps lyrics contiguous when chords split words', () => {
		const preview = renderSongPreview(library, 'Al[D]egria, alegria, alegri[A]a,', 'symbol', 0);
		expect(lyrics(sections(preview)[0])).toBe('Alegria, alegria, alegria,');
	});

	it('reports incomplete input and recovers when it is complete', () => {
		const invalid = renderSongPreview(library, '{', 'symbol', 0);
		expect(invalid.error).toContain('end of input');
		expect(invalid.blocks).toEqual([]);

		const valid = renderSongPreview(library, '{key: C}\n[C]Hola', 'solfege', 0);
		expect(valid.error).toBeNull();
		expect(valid.hasKey).toBe(true);
		expect(chords(sections(valid)[0])).toEqual(['Do']);
	});

	it('requires a key for Nashville notation', () => {
		expect(renderSongPreview(library, '[C]Hola', 'number', 0).error).toContain('{key: ...}');
		const preview = renderSongPreview(library, '{key: C}\n[C]Hola', 'number', 0);
		expect(chords(sections(preview)[0])).toEqual(['1']);
	});

	it('shows a chorus reference as a label by default', () => {
		const content = '{title: Test}\n{start_of_chorus}\n[C]Uno\n{end_of_chorus}\n\n{chorus}';
		const preview = renderSongPreview(library, content, 'symbol', 0);
		expect(preview.title).toBe('Test');
		expect(preview.blocks.map((block) => block.kind)).toEqual(['section', 'chorus-label']);
		expect(lyrics(sections(preview)[0])).toBe('Uno');
	});

	it('expands a chorus reference visually and transposes its chords', () => {
		const content = '{key: C}\n{start_of_chorus}\n[C]Uno\n{end_of_chorus}\n\n{chorus}';
		const preview = renderSongPreview(library, content, 'solfege', 2, 'expanded');
		const [original, repeated] = sections(preview);
		expect(preview.error).toBeNull();
		expect(original.recalled).toBe(false);
		expect(repeated.recalled).toBe(true);
		expect(lyrics(repeated)).toBe('Uno');
		expect(chords(repeated)).toEqual(['Re']);
	});

	it('uses the nearest preceding chorus for an unlabelled reference', () => {
		const content =
			'{start_of_chorus}\n[C]Primero\n{end_of_chorus}\n\n' +
			'{start_of_chorus}\n[D]Segundo\n{end_of_chorus}\n\n{chorus}';
		const preview = renderSongPreview(library, content, 'symbol', 0, 'expanded');
		expect(lyrics(sections(preview).at(-1)!)).toBe('Segundo');
	});

	it('uses the matching named chorus even after another chorus', () => {
		const content =
			'{start_of_chorus: Chorus 2}\n[C]Dos\n{end_of_chorus}\n\n' +
			'{start_of_chorus: Chorus 3}\n[D]Tres\n{end_of_chorus}\n\n' +
			'{chorus: Chorus 2}';
		const preview = renderSongPreview(library, content, 'symbol', 0, 'expanded');
		expect(lyrics(sections(preview).at(-1)!)).toBe('Dos');
	});

	it('accepts the explicit label attribute for named references', () => {
		const content =
			'{start_of_chorus: label="Chorus 2"}\n[C]Dos\n{end_of_chorus}\n\n' +
			'{chorus: label="Chorus 2"}';
		const preview = renderSongPreview(library, content, 'symbol', 0, 'expanded');
		expect(lyrics(sections(preview).at(-1)!)).toBe('Dos');
	});

	it('includes comments inside an expanded chorus', () => {
		const content =
			'{start_of_chorus}\n[C]Uno\n{comment: Suave}\n[D]Dos\n{end_of_chorus}\n\n{chorus}';
		const preview = renderSongPreview(library, content, 'symbol', 0, 'expanded');
		const repeated = sections(preview).at(-1)!;
		expect(lyrics(repeated)).toBe('Uno\nSuave\nDos');
		expect(repeated.lines[1].comment).toBe(true);
	});

	it('shows an inline message when an expanded reference cannot be resolved', () => {
		const preview = renderSongPreview(library, '{chorus: Missing}', 'symbol', 0, 'expanded');
		expect(preview.blocks).toEqual([{ kind: 'missing-chorus', label: 'Missing' }]);
	});
});
