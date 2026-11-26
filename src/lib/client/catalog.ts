import type { Collection, Song } from './types';
import { foldSearchText } from '#lib/core/text-search.js';

export function filterSongs(
	songs: Song[],
	search: string,
	tagId: string,
	collectionId: string
): Song[] {
	const term = foldSearchText(search.trim());
	return songs.filter(
		(song) =>
			(!term || foldSearchText(song.title).includes(term)) &&
			(!tagId || song.tags.some((link) => link.tagId === tagId)) &&
			(!collectionId || song.collections.some((link) => link.collectionId === collectionId))
	);
}

export function collectionSongIds(collection: Collection): string[] {
	return [...collection.songs].sort((a, b) => a.position - b.position).map((entry) => entry.songId);
}

export function changedMembershipIds(
	collection: Collection,
	songId: string,
	shouldInclude: boolean
): string[] | null {
	const ids = collectionSongIds(collection);
	const isIncluded = ids.includes(songId);
	if (isIncluded === shouldInclude) return null;
	return shouldInclude ? [...ids, songId] : ids.filter((id) => id !== songId);
}

export function moved(ids: string[], index: number, delta: number): string[] {
	const target = index + delta;
	if (target < 0 || target >= ids.length) return ids;
	const next = [...ids];
	[next[index], next[target]] = [next[target], next[index]];
	return next;
}
