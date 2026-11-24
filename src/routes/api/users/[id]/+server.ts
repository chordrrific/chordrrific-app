import type { RequestHandler } from './$types';
import { requireAdmin } from '#lib/server/auth.js';
import { api, readBody } from '#lib/server/http.js';
import { deleteUser, updateUser } from '#lib/server/users.js';

export const PATCH: RequestHandler = (event) =>
	api(event, async () => {
		requireAdmin(event);
		return updateUser(event.params.id, await readBody(event));
	});

export const DELETE: RequestHandler = (event) =>
	api(event, async () => {
		requireAdmin(event);
		await deleteUser(event.params.id);
		return { ok: true };
	});
