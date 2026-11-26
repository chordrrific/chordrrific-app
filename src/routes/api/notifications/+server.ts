import type { RequestHandler } from './$types';
import { requireUser } from '#lib/server/auth.js';
import { api, readBody } from '#lib/server/http.js';
import {
	createNotification,
	deleteAllNotifications,
	listNotifications
} from '#lib/server/notifications.js';

export const GET: RequestHandler = (event) =>
	api(event, async () => listNotifications(requireUser(event).id));

export const POST: RequestHandler = (event) =>
	api(event, async () => createNotification(requireUser(event).id, await readBody(event)), 201);

export const DELETE: RequestHandler = (event) =>
	api(event, async () => {
		await deleteAllNotifications(requireUser(event).id);
		return { ok: true };
	});
