import type { Collection } from './types';

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
	if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return ids;
	const next = [...ids];
	[next[index], next[target]] = [next[target], next[index]];
	return next;
}

export function movedTo(ids: readonly string[], songId: string, targetId: string): string[] {
	const from = ids.indexOf(songId);
	const to = ids.indexOf(targetId);
	if (from < 0 || to < 0 || from === to) return [...ids];
	const next = [...ids];
	next.splice(from, 1);
	next.splice(to, 0, songId);
	return next;
}

export function withSongOrder(collection: Collection, ids: readonly string[]): Collection | null {
	const entries = new Map(collection.songs.map((entry) => [entry.songId, entry]));
	if (
		ids.length !== entries.size ||
		new Set(ids).size !== ids.length ||
		ids.some((id) => !entries.has(id))
	)
		return null;
	return {
		...collection,
		songs: ids.map((id, position) => ({ ...entries.get(id)!, position }))
	};
}
