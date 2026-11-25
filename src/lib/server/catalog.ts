import { error } from '@sveltejs/kit';
import { cleanIds, cleanSongContent, cleanText } from '#lib/core/validation.js';
import { titleFromChordPro } from '#lib/core/song-title.js';
import { db } from './db';

export function listSongs(ownerId: string, query?: string, tagId?: string, collectionId?: string) {
	return db.song.findMany({
		where: {
			ownerId,
			...(query ? { title: { contains: query } } : {}),
			...(tagId ? { tags: { some: { tagId, tag: { ownerId } } } } : {}),
			...(collectionId ? { collections: { some: { collectionId, collection: { ownerId } } } } : {})
		},
		include: { tags: { include: { tag: true } }, collections: { include: { collection: true } } },
		orderBy: { title: 'asc' }
	});
}

export async function getSong(ownerId: string, id: string) {
	const song = await db.song.findFirst({
		where: { id, ownerId },
		include: { tags: { include: { tag: true } }, collections: { include: { collection: true } } }
	});
	if (!song) error(404, 'Song not found');
	return song;
}

export function createSong(ownerId: string, input: Record<string, unknown>) {
	const content = cleanSongContent(input.content);
	return db.song.create({
		data: {
			ownerId,
			title: titleFromChordPro(content),
			content
		}
	});
}

export async function updateSong(ownerId: string, id: string, input: Record<string, unknown>) {
	await getSong(ownerId, id);
	const content = input.content === undefined ? undefined : cleanSongContent(input.content);
	return db.song.update({
		where: { id },
		data: {
			title: content === undefined ? undefined : titleFromChordPro(content),
			content
		}
	});
}

export async function deleteSong(ownerId: string, id: string) {
	await getSong(ownerId, id);
	await db.song.delete({ where: { id } });
}

export function listCollections(ownerId: string) {
	return db.collection.findMany({
		where: { ownerId },
		include: {
			songs: {
				orderBy: { position: 'asc' },
				include: { song: { select: { id: true, title: true } } }
			}
		},
		orderBy: { name: 'asc' }
	});
}

export async function getCollection(ownerId: string, id: string) {
	const collection = await db.collection.findFirst({ where: { id, ownerId } });
	if (!collection) error(404, 'Collection not found');
	return collection;
}

export function createCollection(ownerId: string, input: Record<string, unknown>) {
	return db.collection.create({ data: { ownerId, name: cleanText(input.name, 'Name', 100) } });
}

export async function updateCollection(
	ownerId: string,
	id: string,
	input: Record<string, unknown>
) {
	await getCollection(ownerId, id);
	return db.collection.update({
		where: { id },
		data: { name: cleanText(input.name, 'Name', 100) }
	});
}

export async function deleteCollection(ownerId: string, id: string) {
	await getCollection(ownerId, id);
	await db.collection.delete({ where: { id } });
}

export async function setCollectionSongs(ownerId: string, id: string, idsInput: unknown) {
	await getCollection(ownerId, id);
	const songIds = cleanIds(idsInput, 'songIds');
	const owned = await db.song.count({ where: { ownerId, id: { in: songIds } } });
	if (owned !== songIds.length) error(400, 'All songs must belong to your account');
	await db.$transaction(async (tx) => {
		await tx.collectionSong.deleteMany({ where: { collectionId: id } });
		if (songIds.length) {
			await tx.collectionSong.createMany({
				data: songIds.map((songId, position) => ({ collectionId: id, songId, position }))
			});
		}
	});
	return getCollection(ownerId, id);
}

export function listTags(ownerId: string) {
	return db.tag.findMany({ where: { ownerId }, orderBy: { name: 'asc' } });
}

export async function getTag(ownerId: string, id: string) {
	const tag = await db.tag.findFirst({ where: { id, ownerId } });
	if (!tag) error(404, 'Tag not found');
	return tag;
}

export function createTag(ownerId: string, input: Record<string, unknown>) {
	return db.tag.create({ data: { ownerId, name: cleanText(input.name, 'Name', 60) } });
}

export async function updateTag(ownerId: string, id: string, input: Record<string, unknown>) {
	await getTag(ownerId, id);
	return db.tag.update({ where: { id }, data: { name: cleanText(input.name, 'Name', 60) } });
}

export async function deleteTag(ownerId: string, id: string) {
	await getTag(ownerId, id);
	await db.tag.delete({ where: { id } });
}

export async function setSongTags(ownerId: string, id: string, idsInput: unknown) {
	await getSong(ownerId, id);
	const tagIds = cleanIds(idsInput, 'tagIds');
	const owned = await db.tag.count({ where: { ownerId, id: { in: tagIds } } });
	if (owned !== tagIds.length) error(400, 'All tags must belong to your account');
	await db.$transaction(async (tx) => {
		await tx.songTag.deleteMany({ where: { songId: id } });
		if (tagIds.length)
			await tx.songTag.createMany({ data: tagIds.map((tagId) => ({ songId: id, tagId })) });
	});
	return getSong(ownerId, id);
}
