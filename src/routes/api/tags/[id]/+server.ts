import type { RequestHandler } from './$types';
import { requireUser } from '#lib/server/auth.js';
import { api, readBody } from '#lib/server/http.js';
import { deleteTag, updateTag } from '#lib/server/catalog.js';

export const PATCH: RequestHandler = (event) =>
	api(event, async () => updateTag(requireUser(event).id, event.params.id, await readBody(event)));
export const DELETE: RequestHandler = (event) =>
	api(event, async () => {
		await deleteTag(requireUser(event).id, event.params.id);
		return { ok: true };
	});
