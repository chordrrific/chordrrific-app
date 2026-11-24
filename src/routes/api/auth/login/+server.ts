import type { RequestHandler } from './$types';
import { api, readBody } from '#lib/server/http.js';
import { authenticate } from '#lib/server/users.js';
import { startSession } from '#lib/server/auth.js';

export const POST: RequestHandler = (event) =>
	api(event, async () => {
		const body = await readBody(event);
		const user = await authenticate(body.email, body.password);
		await startSession(event, user.id);
		return { id: user.id, email: user.email, isAdmin: user.isAdmin };
	});
