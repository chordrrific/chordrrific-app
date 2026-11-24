import type { RequestHandler } from './$types';
import { requireUser } from '#lib/server/auth.js';
import { api, readBody } from '#lib/server/http.js';
import { setCollectionSongs } from '#lib/server/catalog.js';

export const PUT: RequestHandler = (event) =>
	api(event, async () => {
		const body = await readBody(event);
		return setCollectionSongs(requireUser(event).id, event.params.id, body.songIds);
	});
