import * as library from 'chordsheetjs';
import { describe, expect, it } from 'vitest';
import { renderSongPreview } from './song-preview.js';

describe('song preview', () => {
	it('shows solfege without a key and preserves written accidentals', () => {
		const preview = renderSongPreview(library, '[C]Do [F#]Fa [Bb]Si', 'solfege', 0);
		expect(preview.error).toBeNull();
		expect(preview.hasKey).toBe(false);
		expect(preview.markup).toContain('class="chord">Do</div>');
		expect(preview.markup).toContain('class="chord">Fa#</div>');
		expect(preview.markup).toContain('class="chord">Sib</div>');
	});

	it('converts solfege source chords to symbols without a key', () => {
		const preview = renderSongPreview(library, '[Do]Hola [Fa]mundo', 'symbol', 0);
		expect(preview.error).toBeNull();
		expect(preview.markup).toContain('class="chord">C</div>');
		expect(preview.markup).toContain('class="chord">F</div>');
	});

	it('keeps lyrics contiguous when chords split words', () => {
		const preview = renderSongPreview(library, 'Al[D]egria, alegria, alegri[A]a,', 'solfege', 0);
		expect(preview.error).toBeNull();
		const lyrics = [...preview.markup.matchAll(/<div class="lyrics">([^<]*)<\/div>/g)]
			.map((match) => match[1])
			.join('');
		expect(lyrics).toBe('Alegria, alegria, alegria,');
	});

	it('reports an incomplete directive and recovers when the input is complete', () => {
		const invalid = renderSongPreview(library, '{', 'solfege', 0);
		expect(invalid.error).toContain('end of input');
		expect(invalid.markup).toBe('');

		const valid = renderSongPreview(library, '{key: C}\n[C]Hola', 'solfege', 0);
		expect(valid.error).toBeNull();
		expect(valid.hasKey).toBe(true);
		expect(valid.markup).toContain('class="chord">Do</div>');
	});

	it('requires a key for Nashville notation', () => {
		expect(renderSongPreview(library, '[C]Hola', 'number', 0).error).toContain('{key: ...}');
		const preview = renderSongPreview(library, '{key: C}\n[C]Hola', 'number', 0);
		expect(preview.error).toBeNull();
		expect(preview.markup).toContain('class="chord">1</div>');
	});
});
