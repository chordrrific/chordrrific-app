import { error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { readSession } from '#lib/server/auth.js';

export const handle: Handle = async ({ event, resolve }) => {
	if (!['GET', 'HEAD', 'OPTIONS'].includes(event.request.method)) {
		const origin = event.request.headers.get('origin');
		const site = event.request.headers.get('sec-fetch-site');
		if ((origin && origin !== event.url.origin) || site === 'cross-site') {
			error(403, 'Cross-origin write denied');
		}
	}
	event.locals.user = await readSession(event);
	return resolve(event);
};
