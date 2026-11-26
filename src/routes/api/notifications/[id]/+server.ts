import type { RequestHandler } from './$types';
import { requireUser } from '#lib/server/auth.js';
import { api } from '#lib/server/http.js';
import { deleteNotification, markNotificationRead } from '#lib/server/notifications.js';

export const PATCH: RequestHandler = (event) =>
	api(event, async () => markNotificationRead(requireUser(event).id, event.params.id));

export const DELETE: RequestHandler = (event) =>
	api(event, async () => {
		await deleteNotification(requireUser(event).id, event.params.id);
		return { ok: true };
	});
