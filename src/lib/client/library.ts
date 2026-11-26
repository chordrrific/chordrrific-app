import {
	metadataKeys,
	songMetadata,
	type MetadataKey,
	type SongMetadata
} from '#lib/core/song-metadata.js';
import { foldSearchText } from '#lib/core/text-search.js';
import type { Collection, Song } from './types.js';

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
	return keys.flatMap((key) => {
		const counts = new Map<string, FacetValue>();
		let count = 0;
		for (const song of songs) {
			const values =
				key === 'collection'
					? song.collections.map((link) => link.collection.name)
					: songMetadata(song.content)[key];
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

export function cycleFacet(
	active: readonly FacetSelection[],
	key: FacetKey,
	value: string | undefined,
	additive: boolean
): FacetSelection[] {
	const index = active.findIndex((item) => item.key === key && item.value === value);
	const current = index < 0 ? undefined : active[index];
	const nextMode =
		current?.mode === 'include' ? 'exclude' : current?.mode === 'exclude' ? null : 'include';
	const base = additive || current ? active.filter((_, itemIndex) => itemIndex !== index) : [];
	return nextMode ? [...base, { key, value, mode: nextMode }] : [...base];
}

export function visibleLibrarySongs(
	songs: readonly Song[],
	active: readonly FacetSelection[],
	search: string,
	collections: readonly Collection[]
): Song[] {
	const term = foldSearchText(search.trim());
	const result = songs.filter(
		(song) =>
			(!term || foldSearchText(song.title).includes(term)) &&
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
	return metadata.artist[0] ?? metadata.composer[0] ?? metadata.lyricist[0];
}
