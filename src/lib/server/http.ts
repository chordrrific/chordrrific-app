import { error, isHttpError, type RequestEvent } from '@sveltejs/kit';
import { ValidationError } from '#lib/core/validation.js';

export async function readBody(event: RequestEvent): Promise<Record<string, unknown>> {
	let value: unknown;
	try {
		value = await event.request.json();
	} catch {
		throw new ValidationError('Expected a JSON body');
	}
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new ValidationError('Expected a JSON object');
	}
	return value as Record<string, unknown>;
}

export async function api(
	event: RequestEvent,
	action: () => Promise<unknown>,
	status = 200
): Promise<Response> {
	try {
		return Response.json(await action(), { status });
	} catch (cause) {
		if (isHttpError(cause)) throw cause;
		if (cause instanceof ValidationError) error(400, cause.message);
		if (cause && typeof cause === 'object' && 'code' in cause && cause.code === 'P2002') {
			error(409, 'A record with this value already exists');
		}
		console.error(cause);
		error(500, 'Internal server error');
	}
}
