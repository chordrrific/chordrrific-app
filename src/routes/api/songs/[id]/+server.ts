import type { RequestHandler } from './$types';
import { requireUser } from '#lib/server/auth.js';
import { api, readBody } from '#lib/server/http.js';
import { deleteSong, getSong, updateSong } from '#lib/server/catalog.js';

export const GET: RequestHandler = (event) =>
	api(event, async () => getSong(requireUser(event).id, event.params.id));
export const PATCH: RequestHandler = (event) =>
	api(event, async () => updateSong(requireUser(event).id, event.params.id, await readBody(event)));
export const DELETE: RequestHandler = (event) =>
	api(event, async () => {
		await deleteSong(requireUser(event).id, event.params.id);
		return { ok: true };
	});
