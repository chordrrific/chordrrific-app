import { describe, expect, it } from 'vitest';
import { highlightSegmentedText, highlightText } from './search-highlight.js';

describe('search highlighting', () => {
	it('marks only the matching part, ignoring accents and case', () => {
		expect(highlightText('Navidad', 'nAviDa')).toEqual([
			{ text: 'Navida', matched: true },
			{ text: 'd', matched: false }
		]);
		expect(highlightText('Alegría', 'alegria')).toEqual([{ text: 'Alegría', matched: true }]);
	});

	it('can mark approximate matches for a misspelled filter', () => {
		expect(highlightText('Navidad', 'navidd')).toEqual([{ text: 'Navidad', matched: true }]);
	});

	it('keeps a highlighted word contiguous across chord positions', () => {
		expect(highlightSegmentedText(['Al', 'egria'], 'alegria')).toEqual([
			[{ text: 'Al', matched: true }],
			[{ text: 'egria', matched: true }]
		]);
	});

	it('leaves text untouched when the filter is empty or unrelated', () => {
		expect(highlightText('Una canción', '')).toEqual([{ text: 'Una canción', matched: false }]);
		expect(highlightText('Una canción', 'navidad')).toEqual([
			{ text: 'Una canción', matched: false }
		]);
	});
});
