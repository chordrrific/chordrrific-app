import type { RequestHandler } from './$types';
import { requireUser } from '#lib/server/auth.js';
import { api, readBody } from '#lib/server/http.js';
import { createSong, listSongs } from '#lib/server/catalog.js';

export const GET: RequestHandler = (event) =>
	api(event, async () => {
		const user = requireUser(event);
		return listSongs(
			user.id,
			event.url.searchParams.get('q') ?? undefined,
			event.url.searchParams.get('tagId') ?? undefined,
			event.url.searchParams.get('collectionId') ?? undefined
		);
	});

export const POST: RequestHandler = (event) =>
	api(
		event,
		async () => {
			const user = requireUser(event);
			return createSong(user.id, await readBody(event));
		},
		201
	);
