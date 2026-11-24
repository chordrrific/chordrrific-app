import type { RequestHandler } from './$types';
import { api, readBody } from '#lib/server/http.js';
import { endSession, requireUser } from '#lib/server/auth.js';
import { changeOwnPassword } from '#lib/server/users.js';

export const POST: RequestHandler = (event) =>
	api(event, async () => {
		const user = requireUser(event);
		const body = await readBody(event);
		await changeOwnPassword(user.id, body.currentPassword, body.newPassword);
		await endSession(event);
		return { ok: true };
	});
