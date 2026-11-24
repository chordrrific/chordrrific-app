import type { RequestHandler } from './$types';
import { requireUser } from '#lib/server/auth.js';
import { api, readBody } from '#lib/server/http.js';
import { createTag, listTags } from '#lib/server/catalog.js';

export const GET: RequestHandler = (event) =>
	api(event, async () => listTags(requireUser(event).id));
export const POST: RequestHandler = (event) =>
	api(event, async () => createTag(requireUser(event).id, await readBody(event)), 201);
