import type { RequestHandler } from './$types';
import { requireAdmin } from '#lib/server/auth.js';
import { api, readBody } from '#lib/server/http.js';
import { createUser, listUsers } from '#lib/server/users.js';

export const GET: RequestHandler = (event) =>
	api(event, async () => {
		requireAdmin(event);
		return listUsers();
	});

export const POST: RequestHandler = (event) =>
	api(
		event,
		async () => {
			requireAdmin(event);
			return createUser(await readBody(event));
		},
		201
	);
