import { describe, expect, it } from 'vitest';
import {
	createSongSearch,
	cycleFacet,
	displayAuthor,
	displayAuthorFacet,
	libraryFacets,
	retainAvailableFacets,
	selectFacet,
	soleCollectionFilter,
	soleDisplayFilter,
	visibleLibrarySongs
} from './library.js';
import { songMetadata } from '#lib/core/song-metadata.js';
import type { Collection, Song } from './types.js';

const collection: Collection = {
	id: 'set',
	name: 'Concierto',
	songs: [
		{ songId: 'b', position: 0, song: { id: 'b', title: 'B' } },
		{ songId: 'a', position: 1, song: { id: 'a', title: 'A' } }
	]
};
const songs: Song[] = [
	{
		pinnedTone: null,
		pinnedNotation: null,
		pinnedChorusMode: null,
		id: 'a',
		title: 'A',
		content: '{title: A}\n{artist: Amaral}\n{tag: Pop}',
		tags: [],
		collections: [{ collectionId: 'set', collection }]
	},
	{
		pinnedTone: null,
		pinnedNotation: null,
		pinnedChorusMode: null,
		id: 'b',
		title: 'B',
		content: '{title: B}\n{artist: Mecano}\n{tag: Pop}',
		tags: [],
		collections: [{ collectionId: 'set', collection }]
	},
	{
		id: 'c',
		title: 'C',
		content: '{title: C}\n{composer: Bach}',
		pinnedTone: null,
		pinnedNotation: null,
		pinnedChorusMode: null,
		tags: [],
		collections: []
	}
];

describe('library facets', () => {
	it('counts songs, cycles include/exclude/clear, and combines Ctrl filters', () => {
		const artist = libraryFacets(songs).find((facet) => facet.key === 'artist');
		expect(artist?.count).toBe(2);
		expect(artist?.values.map((entry) => entry.value)).toEqual(['Amaral', 'Mecano']);
		let active = cycleFacet([], 'artist', undefined, false);
		active = cycleFacet(active, 'artist', 'Mecano', true);
		expect(visibleLibrarySongs(songs, active, '', [collection]).map((song) => song.id)).toEqual([
			'b'
		]);
		active = cycleFacet(active, 'artist', 'Mecano', true);
		expect(visibleLibrarySongs(songs, active, '', [collection]).map((song) => song.id)).toEqual([
			'a'
		]);
		active = cycleFacet(active, 'artist', 'Mecano', true);
		expect(active).toEqual([{ key: 'artist', value: undefined, mode: 'include' }]);
	});
	it('replaces multiple filters with one included value on a plain click', () => {
		const active = [
			{ key: 'artist', value: 'Amaral', mode: 'include' },
			{ key: 'tag', value: 'Pop', mode: 'exclude' }
		] as const;
		expect(selectFacet('tag', 'Pop')).toEqual([{ key: 'tag', value: 'Pop', mode: 'include' }]);
		expect(selectFacet('artist', 'Amaral')).toEqual([active[0]]);
		expect(cycleFacet(active, 'artist', 'Amaral', true)).toEqual([
			active[1],
			{ key: 'artist', value: 'Amaral', mode: 'exclude' }
		]);
	});
	it('uses collection membership order for filtered cards and author fallback', () => {
		const active = cycleFacet([], 'collection', 'Concierto', false);
		expect(visibleLibrarySongs(songs, active, '', [collection]).map((song) => song.id)).toEqual([
			'b',
			'a'
		]);
		expect(displayAuthor(songMetadata(songs[2].content))).toBe('Bach');
	});
	it('recognizes only an unambiguous single collection view', () => {
		const selected = [{ key: 'collection', value: 'Concierto', mode: 'include' }] as const;
		expect(soleDisplayFilter(selected, '')).toEqual(selected[0]);
		expect(soleDisplayFilter(selected, 'Alegría')).toBeNull();
		expect(soleCollectionFilter(selected, '', [collection])).toBe(collection);
		expect(soleCollectionFilter(selected, '  ', [collection])).toBe(collection);
		expect(soleCollectionFilter(selected, 'Alegría', [collection])).toBeNull();
		expect(
			soleCollectionFilter([...selected, { key: 'artist', value: 'Mecano', mode: 'include' }], '', [
				collection
			])
		).toBeNull();
		expect(
			soleCollectionFilter([{ key: 'collection', value: 'Concierto', mode: 'exclude' }], '', [
				collection
			])
		).toBeNull();
		expect(
			soleCollectionFilter([{ key: 'collection', mode: 'include' }], '', [collection])
		).toBeNull();
		expect(soleDisplayFilter([{ key: 'artist', mode: 'exclude' }], '')).toEqual({
			key: 'artist',
			mode: 'exclude'
		});
		expect(
			soleDisplayFilter([...selected, { key: 'tag', value: 'Pop', mode: 'include' }], '')
		).toBeNull();
		expect(displayAuthorFacet(songMetadata(songs[2].content))).toEqual({
			key: 'composer',
			value: 'Bach'
		});
	});
	it('removes filters whose values disappear after songs or memberships change', () => {
		const active = [
			{ key: 'collection', value: 'Concierto', mode: 'include' },
			{ key: 'tag', value: 'Pop', mode: 'exclude' },
			{ key: 'artist', value: 'AMARAL', mode: 'include' },
			{ key: 'composer', mode: 'include' }
		] as const;
		const updatedSongs = [
			{ ...songs[0], content: '{title: A}\n{artist: Amaral}', collections: [] },
			songs[2]
		];
		const available = libraryFacets(updatedSongs);
		expect(retainAvailableFacets(active, available)).toEqual(active.slice(2));
		expect(retainAvailableFacets(active.slice(0, 2), available)).toEqual([]);
		expect(visibleLibrarySongs(updatedSongs, [], '', []).map((song) => song.id)).toEqual([
			'a',
			'c'
		]);
		expect(retainAvailableFacets([{ key: 'artist', mode: 'include' }], [])).toEqual([]);
	});
	it('matches song titles regardless of accents and letter case', () => {
		const titled = { ...songs[0], title: 'Título' };
		for (const query of ['TITULO', 'Título', 'tÍtulo', 'Titulo', 'Ti\u0301tulo']) {
			expect(visibleLibrarySongs([titled], [], query, []).map((song) => song.id)).toEqual(['a']);
		}
	});
	it('searches metadata, collections and distant lyrics with typo tolerance', () => {
		const song = {
			...songs[0],
			title: 'Alegría de Belén',
			content:
				'{title: Alegría de Belén}\n{artist: José Álvarez}\n{tag: Navidad}\n{subtitle: Nochebuena}\n' +
				'Primera estrofa\n'.repeat(40) +
				'La vi[E]rgen está lavando'
		};
		const library = [song, ...songs.slice(1)];
		const index = createSongSearch(library);
		for (const query of [
			'ALEGRIA',
			'jose',
			'navidad',
			'nochebuena',
			'virgen',
			'lavndo',
			'jose lavndo'
		]) {
			expect(
				visibleLibrarySongs(library, [], query, [collection], index).map(({ id }) => id),
				query
			).toEqual(['a']);
		}
		expect(
			visibleLibrarySongs(library, [], 'consierto', [collection], index).map(({ id }) => id)
		).toEqual(['a', 'b']);
		expect(
			visibleLibrarySongs(
				library,
				[{ key: 'collection', value: 'Concierto', mode: 'include' }],
				'consierto',
				[collection],
				index
			).map(({ id }) => id)
		).toEqual(['b', 'a']);
	});
});
