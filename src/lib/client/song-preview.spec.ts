import * as library from 'chordsheetjs';
import { describe, expect, it } from 'vitest';
import { renderSongPreview } from './song-preview.js';

describe('song preview', () => {
	it('shows solfege without a key and preserves written accidentals', () => {
		const preview = renderSongPreview(library, '[C]Do [F#]Fa [Bb]Si', 'solfege', 0);
		expect(preview.error).toBeNull();
		expect(preview.hasKey).toBe(false);
		expect(preview.markup).toContain('>Do</td>');
		expect(preview.markup).toContain('>Fa#</td>');
		expect(preview.markup).toContain('>Sib</td>');
	});

	it('converts solfege source chords to symbols without a key', () => {
		const preview = renderSongPreview(library, '[Do]Hola [Fa]mundo', 'symbol', 0);
		expect(preview.error).toBeNull();
		expect(preview.markup).toContain('>C</td>');
		expect(preview.markup).toContain('>F</td>');
	});

	it('reports an incomplete directive and recovers when the input is complete', () => {
		const invalid = renderSongPreview(library, '{', 'solfege', 0);
		expect(invalid.error).toContain('end of input');
		expect(invalid.markup).toBe('');

		const valid = renderSongPreview(library, '{key: C}\n[C]Hola', 'solfege', 0);
		expect(valid.error).toBeNull();
		expect(valid.hasKey).toBe(true);
		expect(valid.markup).toContain('>Do</td>');
	});

	it('requires a key for Nashville notation', () => {
		expect(renderSongPreview(library, '[C]Hola', 'number', 0).error).toContain('{key: ...}');
		const preview = renderSongPreview(library, '{key: C}\n[C]Hola', 'number', 0);
		expect(preview.error).toBeNull();
		expect(preview.markup).toContain('>1</td>');
	});
});
