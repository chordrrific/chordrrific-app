import type { RequestHandler } from './$types';
import { api } from '#lib/server/http.js';
import { endSession } from '#lib/server/auth.js';

export const POST: RequestHandler = (event) =>
	api(event, async () => {
		await endSession(event);
		return { ok: true };
	});
