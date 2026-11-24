import type { RequestHandler } from './$types';
import { api } from '#lib/server/http.js';
import { requireUser } from '#lib/server/auth.js';

export const GET: RequestHandler = (event) => api(event, async () => requireUser(event));
