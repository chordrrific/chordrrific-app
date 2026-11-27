import Fuse from 'fuse.js';
import {
	metadataKeys,
	songMetadata,
	type MetadataKey,
	type SongMetadata
} from '#lib/core/song-metadata.js';
import { songSearchText } from '#lib/core/song-search-text.js';
import { highlightText, searchWords } from './search-highlight.js';
import type { Collection, Song } from './types.js';

interface SongSearchDocument {
	song: Song;
	title: string[];
	metadata: string[];
	collections: string[];
	lyrics: string[];
}

export function createSongSearch(songs: readonly Song[]): Fuse<SongSearchDocument> {
	return new Fuse(
		songs.map((song) => {
			const content = songSearchText(song.content);
			return {
				song,
				title: searchWords(song.title),
				metadata: content.metadata.flatMap(searchWords),
				collections: song.collections.flatMap((link) => searchWords(link.collection.name)),
				lyrics: searchWords(content.lyrics)
			};
		}),
		{
			keys: [
				{ name: 'title', weight: 4 },
				{ name: 'metadata', weight: 2 },
				{ name: 'collections', weight: 2 },
				{ name: 'lyrics', weight: 1 }
			],
			ignoreDiacritics: true,
			ignoreLocation: true,
			threshold: 0.2,
			shouldSort: false
		}
	);
}

export interface SongSearchEvidence {
	text: string;
	kind: 'title' | 'metadata' | 'collection' | 'lyrics';
}

export function songSearchEvidence(song: Song, query: string): SongSearchEvidence | null {
	if (!query.trim()) return null;
	const content = songSearchText(song.content);
	const candidates: SongSearchEvidence[] = [
		{ text: song.title, kind: 'title' },
		...song.collections.map((link) => ({
			text: link.collection.name,
			kind: 'collection' as const
		})),
		...content.metadata.map((text) => ({ text, kind: 'metadata' as const })),
		...content.lyrics.split('\n').map((text) => ({ text: text.trim(), kind: 'lyrics' as const }))
	];
	for (const candidate of candidates) {
		const parts = highlightText(candidate.text, query);
		const matchIndex = parts.findIndex((part) => part.matched);
		if (matchIndex < 0) continue;
		if (candidate.kind === 'title') return candidate;
		const matchStart = parts
			.slice(0, matchIndex)
			.reduce((length, part) => length + part.text.length, 0);
		const start = Math.max(0, matchStart - 12);
		const end = Math.min(candidate.text.length, matchStart + parts[matchIndex].text.length + 56);
		return {
			kind: candidate.kind,
			text: `${start ? '…' : ''}${candidate.text.slice(start, end)}${end < candidate.text.length ? '…' : ''}`
		};
	}
	return null;
}

export type FacetKey = MetadataKey | 'collection';
export type FacetMode = 'include' | 'exclude';
export interface FacetSelection {
	key: FacetKey;
	value?: string;
	mode: FacetMode;
}
export interface FacetValue {
	value: string;
	count: number;
}
export interface Facet {
	key: FacetKey;
	count: number;
	values: FacetValue[];
}

export function songValues(song: Song, key: FacetKey): string[] {
	if (key === 'collection') return song.collections.map((link) => link.collection.name);
	return songMetadata(song.content)[key];
}

export function libraryFacets(songs: readonly Song[]): Facet[] {
	const keys: readonly FacetKey[] = [...metadataKeys, 'collection'];
	const documents = songs.map((song) => ({
		metadata: songMetadata(song.content),
		collections: song.collections.map((link) => link.collection.name)
	}));
	return keys.flatMap((key) => {
		const counts = new Map<string, FacetValue>();
		let count = 0;
		for (const document of documents) {
			const values = key === 'collection' ? document.collections : document.metadata[key];
			if (values.length) count += 1;
			for (const value of new Set(values)) {
				const normalized = value.toLocaleLowerCase();
				const found = counts.get(normalized);
				if (found) found.count += 1;
				else counts.set(normalized, { value, count: 1 });
			}
		}
		if (count === 0) return [];
		const values = [...counts.values()].sort((a, b) => a.value.localeCompare(b.value));
		return [{ key, count, values }];
	});
}

export function contextualLibraryFacets(
	visibleSongs: readonly Song[],
	active: readonly FacetSelection[]
): Facet[] {
	const keys: readonly FacetKey[] = [...metadataKeys, 'collection'];
	const facets = new Map(libraryFacets(visibleSongs).map((facet) => [facet.key, facet]));
	for (const selection of active) {
		let facet = facets.get(selection.key);
		if (!facet) {
			facet = { key: selection.key, count: 0, values: [] };
			facets.set(selection.key, facet);
		}
		if (
			selection.value !== undefined &&
			!facet.values.some(
				(entry) => entry.value.toLocaleLowerCase() === selection.value?.toLocaleLowerCase()
			)
		) {
			facet.values.push({ value: selection.value, count: 0 });
			facet.values.sort((a, b) => a.value.localeCompare(b.value));
		}
	}
	return keys.flatMap((key) => {
		const facet = facets.get(key);
		return facet ? [facet] : [];
	});
}

export function retainAvailableFacets(
	active: readonly FacetSelection[],
	available: readonly Facet[]
): FacetSelection[] {
	const byKey = new Map(available.map((facet) => [facet.key, facet]));
	return active.filter((selection) => {
		const facet = byKey.get(selection.key);
		if (!facet) return false;
		if (selection.value === undefined) return true;
		return facet.values.some(
			(entry) => entry.value.toLocaleLowerCase() === selection.value?.toLocaleLowerCase()
		);
	});
}

export function cycleFacet(
	active: readonly FacetSelection[],
	key: FacetKey,
	value: string | undefined,
	additive: boolean
): FacetSelection[] {
	const index = active.findIndex(
		(item) =>
			item.key === key &&
			(item.value === undefined || value === undefined
				? item.value === value
				: item.value.toLocaleLowerCase() === value.toLocaleLowerCase())
	);
	const current = index < 0 ? undefined : active[index];
	const nextMode =
		current?.mode === 'include' ? 'exclude' : current?.mode === 'exclude' ? null : 'include';
	const base = additive || current ? active.filter((_, itemIndex) => itemIndex !== index) : [];
	return nextMode ? [...base, { key, value, mode: nextMode }] : [...base];
}

export function selectFacet(key: FacetKey, value: string | undefined): FacetSelection[] {
	return [{ key, value, mode: 'include' }];
}

export function soleDisplayFilter(
	active: readonly FacetSelection[],
	search: string
): FacetSelection | null {
	return active.length === 1 && !search.trim() ? active[0] : null;
}

export function soleCollectionFilter(
	active: readonly FacetSelection[],
	search: string,
	collections: readonly Collection[]
): Collection | null {
	const filter = soleDisplayFilter(active, search);
	if (!filter || filter.key !== 'collection' || filter.mode !== 'include' || !filter.value)
		return null;
	return (
		collections.find(
			(collection) => collection.name.toLocaleLowerCase() === filter.value?.toLocaleLowerCase()
		) ?? null
	);
}

export function visibleLibrarySongs(
	songs: readonly Song[],
	active: readonly FacetSelection[],
	search: string,
	collections: readonly Collection[],
	searchIndex = createSongSearch(songs)
): Song[] {
	const term = search.trim();
	const words = searchWords(term);
	const matchingIds = term
		? (words.reduce<Set<string> | null>((ids, word) => {
				const matches = new Set(searchIndex.search(word).map(({ item }) => item.song.id));
				return ids === null ? matches : new Set([...ids].filter((id) => matches.has(id)));
			}, null) ?? new Set<string>())
		: null;
	const result = songs.filter(
		(song) =>
			(!matchingIds || matchingIds.has(song.id)) &&
			active.every((item) => {
				const values = songValues(song, item.key);
				const matches =
					item.value === undefined
						? values.length > 0
						: values.some((value) => value.toLocaleLowerCase() === item.value?.toLocaleLowerCase());
				return item.mode === 'include' ? matches : !matches;
			})
	);
	const collectionFilter = active.find(
		(item) => item.key === 'collection' && item.value && item.mode === 'include'
	);
	const collection = collections.find((item) => item.name === collectionFilter?.value);
	const positions = new Map(collection?.songs.map((entry) => [entry.songId, entry.position]));
	return result.sort((a, b) => {
		if (collection) {
			const positionA = positions.get(a.id) ?? Number.MAX_SAFE_INTEGER;
			const positionB = positions.get(b.id) ?? Number.MAX_SAFE_INTEGER;
			if (positionA !== positionB) return positionA - positionB;
		}
		return a.title.localeCompare(b.title);
	});
}

export function displayAuthor(metadata: SongMetadata): string | undefined {
	return displayAuthorFacet(metadata)?.value;
}

export function displayAuthorFacet(
	metadata: SongMetadata
): { key: 'artist' | 'composer' | 'lyricist'; value: string } | null {
	for (const key of ['artist', 'composer', 'lyricist'] as const) {
		const value = metadata[key][0];
		if (value) return { key, value };
	}
	return null;
}
