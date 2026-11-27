import { describe, expect, it } from 'vitest';
import { isSongSortKey, sortLibrarySongs } from './song-sort.js';
import type { Collection, Song } from './types.js';

const collection: Collection = {
	id: 'concert',
	name: 'Concierto',
	songs: [
		{ songId: 'b', position: 0, song: { id: 'b', title: 'B' } },
		{ songId: 'a', position: 1, song: { id: 'a', title: 'A' } }
	]
};
const songs: Song[] = [
	{
		id: 'a',
		title: 'Árbol',
		content: '{title: Árbol}\n{artist: Zeta}\n{year: 2020}',
		tags: [],
		collections: [{ collectionId: collection.id, collection }],
		pinnedTone: null,
		pinnedNotation: null,
		pinnedChorusMode: null
	},
	{
		id: 'b',
		title: 'Balada',
		content: '{title: Balada}\n{artist: Ana}\n{year: 1999}',
		tags: [],
		collections: [{ collectionId: collection.id, collection }],
		pinnedTone: null,
		pinnedNotation: null,
		pinnedChorusMode: null
	},
	{
		id: 'c',
		title: 'Canción',
		content: '{title: Canción}',
		tags: [],
		collections: [],
		pinnedTone: null,
		pinnedNotation: null,
		pinnedChorusMode: null
	}
];

describe('song sorting', () => {
	it('sorts titles and metadata, with missing metadata last', () => {
		expect(sortLibrarySongs(songs, 'title', null, 'es').map((song) => song.id)).toEqual([
			'a',
			'b',
			'c'
		]);
		expect(sortLibrarySongs(songs, 'artist', null, 'es').map((song) => song.id)).toEqual([
			'b',
			'a',
			'c'
		]);
		expect(sortLibrarySongs(songs, 'year', null, 'es').map((song) => song.id)).toEqual([
			'b',
			'a',
			'c'
		]);
	});

	it('uses collection positions only when collection order is selected', () => {
		const inCollection = songs.slice(0, 2);
		expect(
			sortLibrarySongs(inCollection, 'collection-order', collection, 'es').map((song) => song.id)
		).toEqual(['b', 'a']);
		expect(
			sortLibrarySongs(inCollection, 'title', collection, 'es').map((song) => song.id)
		).toEqual(['a', 'b']);
	});

	it('accepts only the persisted fields available in the menu', () => {
		expect(isSongSortKey('collection')).toBe(true);
		expect(isSongSortKey('tempo')).toBe(true);
		expect(isSongSortKey('collection-order')).toBe(false);
		expect(isSongSortKey('unknown')).toBe(false);
	});
});
