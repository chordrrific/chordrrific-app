import { describe, expect, it } from 'vitest';
import { changedMembershipIds, moved, movedTo, withSongOrder } from './catalog';
import type { Collection } from './types';

const collection: Collection = {
	id: 'set',
	name: 'Setlist',
	songs: [
		{ songId: 'b', position: 1, song: { id: 'b', title: 'B' } },
		{ songId: 'a', position: 0, song: { id: 'a', title: 'A' } }
	]
};

describe('collection ordering', () => {
	it('preserves positions when membership is unchanged', () => {
		expect(changedMembershipIds(collection, 'a', true)).toBeNull();
		expect(changedMembershipIds(collection, 'c', false)).toBeNull();
	});
	it('appends new songs and allows explicit reordering', () => {
		expect(changedMembershipIds(collection, 'c', true)).toEqual(['a', 'b', 'c']);
		expect(moved(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
		expect(movedTo(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a']);
		expect(movedTo(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
		expect(withSongOrder(collection, ['b', 'a'])?.songs.map((entry) => entry.position)).toEqual([
			0, 1
		]);
		expect(withSongOrder(collection, ['a', 'a'])).toBeNull();
	});
});
