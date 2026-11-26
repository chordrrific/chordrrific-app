import { afterAll, describe, expect, it } from 'vitest';
import { db } from '../../src/lib/server/db';
import { createUser, deleteUser, updateUser } from '../../src/lib/server/users';
import {
	createNotification,
	deleteAllNotifications,
	deleteNotification,
	listNotifications,
	markNotificationRead
} from '../../src/lib/server/notifications';
import {
	createCollection,
	createSong,
	createTag,
	getSong,
	listSongs,
	setCollectionSongs,
	setSongTags,
	updateSong
} from '../../src/lib/server/catalog';

afterAll(async () => {
	await db.$disconnect();
});

describe('SQLite integration', () => {
	it('persists optional viewer pins per song and protects their ownership', async () => {
		const owner = await createUser({
			email: 'viewer-owner@example.com',
			password: 'long-test-password-viewer'
		});
		const other = await createUser({
			email: 'viewer-other@example.com',
			password: 'long-test-password-other'
		});
		const song = await createSong(owner.id, { content: '{title: Viewer}\n[Am]Music' });
		expect(song.pinnedTone).toBeNull();
		expect(song.pinnedNotation).toBeNull();
		expect(song.pinnedChorusMode).toBeNull();
		await updateSong(owner.id, song.id, {
			pinnedTone: 9,
			pinnedNotation: 'special-solfege',
			pinnedChorusMode: 'expanded'
		});
		expect(await getSong(owner.id, song.id)).toMatchObject({
			pinnedTone: 9,
			pinnedNotation: 'special-solfege',
			pinnedChorusMode: 'expanded'
		});
		await expect(updateSong(other.id, song.id, { pinnedTone: 0 })).rejects.toMatchObject({
			status: 404
		});
		await expect(updateSong(owner.id, song.id, { pinnedTone: 12 })).rejects.toThrow('Pinned tone');
		await expect(updateSong(owner.id, song.id, { pinnedNotation: 'invalid' })).rejects.toThrow(
			'Pinned notation'
		);
		await updateSong(owner.id, song.id, {
			pinnedTone: null,
			pinnedNotation: null,
			pinnedChorusMode: null
		});
		expect(await getSong(owner.id, song.id)).toMatchObject({
			pinnedTone: null,
			pinnedNotation: null,
			pinnedChorusMode: null
		});
		await deleteUser(owner.id);
		await deleteUser(other.id);
	});

	it('indexes the ChordPro title and requires it on every content save', async () => {
		const user = await createUser({
			email: 'title@example.com',
			password: 'long-test-password-title'
		});
		expect(() => createSong(user.id, { content: '[C]No title' })).toThrow('{title: ...}');
		const song = await createSong(user.id, {
			title: 'Ignored',
			content: '{title: First}\n[C]Text'
		});
		expect(song.title).toBe('First');
		const updated = await updateSong(user.id, song.id, { content: '{t: Second}\n[D]Text' });
		expect(updated.title).toBe('Second');
		await expect(updateSong(user.id, song.id, { content: '[E]No title' })).rejects.toThrow(
			'{title: ...}'
		);
		expect((await getSong(user.id, song.id)).title).toBe('Second');
		const tagged = await updateSong(user.id, song.id, {
			content: '{title: Second}\n{tag: Acústico}\n[D]Text'
		});
		expect((await getSong(user.id, tagged.id)).tags.map((link) => link.tag.name)).toEqual([
			'Acústico'
		]);
		await updateSong(user.id, song.id, { content: '{title: Second}\n[D]Text' });
		expect((await getSong(user.id, song.id)).tags).toEqual([]);
		await deleteUser(user.id);
	});

	it('keeps libraries private, preserves collection order, and cascades user deletion', async () => {
		const a = await createUser({ email: 'a@example.com', password: 'long-test-password-a' });
		const b = await createUser({ email: 'b@example.com', password: 'long-test-password-b' });
		const song1 = await createSong(a.id, { content: '{title: Alpha}\n[C]One' });
		const song2 = await createSong(a.id, { content: '{title: Beta}\n[G]Two' });
		const collection = await createCollection(a.id, { name: 'Setlist' });
		const tag = await createTag(a.id, { name: 'Acoustic' });
		await setCollectionSongs(a.id, collection.id, [song2.id, song1.id]);
		await setSongTags(a.id, song1.id, [tag.id]);
		expect((await getSong(a.id, song1.id)).content).toContain('{tag: Acoustic}');
		expect(
			(
				await db.collectionSong.findMany({
					where: { collectionId: collection.id },
					orderBy: { position: 'asc' }
				})
			).map((entry) => entry.songId)
		).toEqual([song2.id, song1.id]);
		await setCollectionSongs(a.id, collection.id, [song1.id, song2.id]);
		expect(
			(
				await db.collectionSong.findMany({
					where: { collectionId: collection.id },
					orderBy: { position: 'asc' }
				})
			).map((entry) => entry.songId)
		).toEqual([song1.id, song2.id]);
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

	it('keeps notifications private, marks them read, deletes them and cascades with the user', async () => {
		const owner = await createUser({
			email: 'alerts@example.com',
			password: 'long-test-password-a'
		});
		const other = await createUser({
			email: 'other-alerts@example.com',
			password: 'long-test-password-b'
		});
		const entry = await createNotification(owner.id, {
			kind: 'success',
			title: 'Imported',
			body: 'One song'
		});
		expect((await listNotifications(owner.id)).map((item) => item.id)).toEqual([entry.id]);
		expect(await listNotifications(other.id)).toEqual([]);
		await expect(markNotificationRead(other.id, entry.id)).rejects.toMatchObject({ status: 404 });
		await expect(deleteNotification(other.id, entry.id)).rejects.toMatchObject({ status: 404 });
		expect((await markNotificationRead(owner.id, entry.id)).readAt).not.toBeNull();
		await deleteNotification(owner.id, entry.id);
		expect(await listNotifications(owner.id)).toEqual([]);
		await createNotification(owner.id, { kind: 'error', title: 'Failed', body: 'Bad file' });
		await createNotification(owner.id, { kind: 'info', title: 'Another', body: '' });
		const otherEntry = await createNotification(other.id, {
			kind: 'info',
			title: 'Private',
			body: ''
		});
		await deleteAllNotifications(owner.id);
		expect(await listNotifications(owner.id)).toEqual([]);
		expect((await listNotifications(other.id)).map((item) => item.id)).toEqual([otherEntry.id]);
		await createNotification(owner.id, { kind: 'error', title: 'Failed', body: 'Bad file' });
		await deleteUser(owner.id);
		expect(await db.notification.count({ where: { ownerId: owner.id } })).toBe(0);
		await deleteUser(other.id);
	});
});
