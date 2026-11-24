export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
	const response = await fetch(path, {
		method,
		headers: {
			Accept: 'application/json',
			...(body === undefined ? {} : { 'Content-Type': 'application/json' })
		},
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const data: unknown = await response.json().catch(() => null);
	if (!response.ok) {
		const message =
			data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
				? data.message
				: `Request failed (${response.status})`;
		throw new ApiError(message, response.status);
	}
	return data as T;
}
