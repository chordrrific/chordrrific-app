import { describe, expect, it } from 'vitest';
import { generalToneOffset, generalViewerSettings } from './viewer-defaults.js';
import { offsetForTone, transposeSongKey } from './viewer-music.js';

describe('viewer tone preferences', () => {
	it('uses the original tone and solfege as general defaults', () => {
		expect(generalViewerSettings).toMatchObject({ tone: 'original', notation: 'solfege' });
		expect(generalToneOffset({ pitchClass: 9, minor: true })).toBe(0);
	});

	it('maps an absolute pinned tone into the twelve-position slider', () => {
		const original = { pitchClass: 0, minor: false };
		expect(offsetForTone(original, 7)).toBe(-5);
		expect(transposeSongKey(original, offsetForTone(original, 7)).pitchClass).toBe(7);
	});
});
