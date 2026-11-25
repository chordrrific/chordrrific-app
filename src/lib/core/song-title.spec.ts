import { describe, expect, it } from 'vitest';
import { hasTitleDirective, titleFromChordPro } from './song-title.js';

describe('ChordPro title', () => {
	it('uses the first title directive and accepts its short form', () => {
		expect(titleFromChordPro('{title: First}\n{title: Second}')).toBe('First');
		expect(titleFromChordPro('{t: Short}\n[C]Song')).toBe('Short');
	});

	it('requires a nonempty title when saving', () => {
		expect(hasTitleDirective('[C]Song')).toBe(false);
		expect(hasTitleDirective('{title: }\n[C]Song')).toBe(false);
		expect(() => titleFromChordPro('[C]Song')).toThrow('{title: ...}');
		expect(() => titleFromChordPro('{title: }')).toThrow();
	});
});
