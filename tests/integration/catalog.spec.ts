import { afterAll, describe, expect, it } from 'vitest';
import { db } from '../../src/lib/server/db';
import { createUser, deleteUser, updateUser } from '../../src/lib/server/users';
import {
	createCollection,
	createSong,
	createTag,
	getSong,
	listSongs,
	setCollectionSongs,
	setSongTags
} from '../../src/lib/server/catalog';

afterAll(async () => {
	await db.$disconnect();
});

describe('SQLite integration', () => {
	it('keeps libraries private, preserves collection order, and cascades user deletion', async () => {
		const a = await createUser({ email: 'a@example.com', password: 'long-test-password-a' });
		const b = await createUser({ email: 'b@example.com', password: 'long-test-password-b' });
		const song1 = await createSong(a.id, { title: 'Alpha', content: '[C]One' });
		const song2 = await createSong(a.id, { title: 'Beta', content: '[G]Two' });
		const collection = await createCollection(a.id, { name: 'Setlist' });
		const tag = await createTag(a.id, { name: 'Acoustic' });
		await setCollectionSongs(a.id, collection.id, [song2.id, song1.id]);
		await setSongTags(a.id, song1.id, [tag.id]);
		expect(
			(
				await db.collectionSong.findMany({
					where: { collectionId: collection.id },
					orderBy: { position: 'asc' }
				})
			).map((entry) => entry.songId)
		).toEqual([song2.id, song1.id]);
		expect(await listSongs(b.id)).toEqual([]);
		await expect(getSong(b.id, song1.id)).rejects.toMatchObject({ status: 404 });
		await expect(setCollectionSongs(b.id, collection.id, [song1.id])).rejects.toMatchObject({
			status: 404
		});
		await deleteUser(a.id);
		expect(await db.song.count({ where: { ownerId: a.id } })).toBe(0);
		expect(await db.collection.count({ where: { ownerId: a.id } })).toBe(0);
		expect(await db.tag.count({ where: { ownerId: a.id } })).toBe(0);
		await deleteUser(b.id);
	});

	it('protects the last administrator', async () => {
		const first = await db.user.findUniqueOrThrow({ where: { email: 'seed@example.com' } });
		expect(await db.user.count({ where: { isAdmin: true } })).toBe(1);
		await expect(deleteUser(first.id)).rejects.toMatchObject({ status: 409 });
		await expect(updateUser(first.id, { isAdmin: false })).rejects.toMatchObject({ status: 409 });
		const second = await createUser({
			email: 'admin2@example.com',
			password: 'long-test-password-b',
			isAdmin: true
		});
		await updateUser(first.id, { isAdmin: false });
		await deleteUser(first.id);
		expect((await db.user.findUnique({ where: { id: second.id } }))?.isAdmin).toBe(true);
	});
});
