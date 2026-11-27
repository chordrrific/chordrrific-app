import { metadataKeys, songMetadata, type MetadataKey } from '#lib/core/song-metadata.js';
import type { Collection, Song } from './types.js';

export const songSortFields = [...metadataKeys, 'collection'] as const;
export type SongSortKey = 'title' | MetadataKey | 'collection';
export type SongSortMode = SongSortKey | 'collection-order';

export function isSongSortKey(value: string | null): value is SongSortKey {
	return value === 'title' || songSortFields.some((field) => field === value);
}

export function sortLibrarySongs(
	songs: readonly Song[],
	mode: SongSortMode,
	collection: Collection | null,
	locale: string
): Song[] {
	const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
	const positions = new Map(collection?.songs.map((entry) => [entry.songId, entry.position]));
	const decorated = songs.map((song) => {
		const values =
			mode === 'title' || mode === 'collection-order'
				? []
				: mode === 'collection'
					? song.collections.map((entry) => entry.collection.name)
					: songMetadata(song.content)[mode];
		return { song, value: values.sort(collator.compare)[0] ?? null };
	});
	decorated.sort((a, b) => {
		if (mode === 'collection-order' && collection) {
			const positionA = positions.get(a.song.id) ?? Number.MAX_SAFE_INTEGER;
			const positionB = positions.get(b.song.id) ?? Number.MAX_SAFE_INTEGER;
			if (positionA !== positionB) return positionA - positionB;
		} else if (mode !== 'title' && mode !== 'collection-order') {
			if (a.value === null && b.value !== null) return 1;
			if (a.value !== null && b.value === null) return -1;
			if (a.value !== null && b.value !== null) {
				const byValue = collator.compare(a.value, b.value);
				if (byValue !== 0) return byValue;
			}
		}
		return collator.compare(a.song.title, b.song.title) || a.song.id.localeCompare(b.song.id);
	});
	return decorated.map(({ song }) => song);
}
