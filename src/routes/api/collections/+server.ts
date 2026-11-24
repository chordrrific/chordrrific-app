import type { RequestHandler } from './$types';
import { requireUser } from '#lib/server/auth.js';
import { api, readBody } from '#lib/server/http.js';
import { createCollection, listCollections } from '#lib/server/catalog.js';

export const GET: RequestHandler = (event) =>
	api(event, async () => listCollections(requireUser(event).id));
export const POST: RequestHandler = (event) =>
	api(event, async () => createCollection(requireUser(event).id, await readBody(event)), 201);
