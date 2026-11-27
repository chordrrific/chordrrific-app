import { describe, expect, it } from 'vitest';
import { cleanSongViewerPins, viewerNotations } from './viewer-preferences.js';

describe('viewer notation preferences', () => {
	it('keeps hidden notation last and accepts it as a song preference', () => {
		expect(viewerNotations.at(-1)).toBe('hidden');
		expect(cleanSongViewerPins({ pinnedNotation: 'hidden' })).toEqual({
			pinnedNotation: 'hidden'
		});
	});
});
