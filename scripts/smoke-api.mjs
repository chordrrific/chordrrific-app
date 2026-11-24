import assert from 'node:assert/strict';

const base = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;
if (!email || !password) throw new Error('Set SMOKE_EMAIL and SMOKE_PASSWORD');

async function call(path, method = 'GET', body, cookie) {
	const response = await fetch(new URL(path, base), {
		method,
		headers: {
			Accept: 'application/json',
			...(cookie ? { Cookie: cookie } : {}),
			...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
			...(method === 'GET' ? {} : { Origin: new URL(base).origin })
		},
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const data = await response.json().catch(() => null);
	return { response, data };
}

async function login(userEmail, userPassword) {
	const { response } = await call('/api/auth/login', 'POST', {
		email: userEmail,
		password: userPassword
	});
	assert.equal(response.status, 200);
	const cookie = response.headers.get('set-cookie')?.split(';')[0];
	assert.ok(cookie);
	return cookie;
}

const cookie = await login(email, password);
const forgedCookie = cookie.replace(/\.[^.]+$/, '.invalid-secret');
assert.equal(
	(await call('/api/auth/logout', 'POST', undefined, forgedCookie)).response.status,
	200
);
assert.equal((await call('/api/auth/me', 'GET', undefined, cookie)).response.status, 200);
const crossOrigin = await fetch(new URL('/api/songs', base), {
	method: 'POST',
	headers: { Cookie: cookie, Origin: 'https://other.example', 'Content-Type': 'application/json' },
	body: JSON.stringify({ title: 'Denied', content: '[C]Denied' })
});
assert.equal(crossOrigin.status, 403);
let songId;
let collectionId;
let tagId;
let userId;

try {
	const suffix = Date.now().toString(36);
	let result = await call(
		'/api/songs',
		'POST',
		{ title: `Smoke ${suffix}`, content: '{key: C}\n[C]Test' },
		cookie
	);
	assert.equal(result.response.status, 201);
	songId = result.data.id;
	result = await call('/api/collections', 'POST', { name: `Set ${suffix}` }, cookie);
	assert.equal(result.response.status, 201);
	collectionId = result.data.id;
	result = await call('/api/tags', 'POST', { name: `Tag ${suffix}` }, cookie);
	assert.equal(result.response.status, 201);
	tagId = result.data.id;
	assert.equal(
		(await call(`/api/collections/${collectionId}/songs`, 'PUT', { songIds: [songId] }, cookie))
			.response.status,
		200
	);
	assert.equal(
		(await call(`/api/songs/${songId}/tags`, 'PUT', { tagIds: [tagId] }, cookie)).response.status,
		200
	);
	result = await call(
		`/api/songs?collectionId=${collectionId}&tagId=${tagId}`,
		'GET',
		undefined,
		cookie
	);
	assert.equal(result.response.status, 200);
	assert.equal(result.data.length, 1);
	result = await call(
		'/api/users',
		'POST',
		{ email: `smoke-${suffix}@example.com`, password: 'temporary-smoke-password-123' },
		cookie
	);
	assert.equal(result.response.status, 201);
	userId = result.data.id;
	const otherCookie = await login(result.data.email, 'temporary-smoke-password-123');
	assert.deepEqual((await call('/api/songs', 'GET', undefined, otherCookie)).data, []);
	assert.equal(
		(await call(`/api/songs/${songId}`, 'GET', undefined, otherCookie)).response.status,
		404
	);
	console.log('API smoke test passed: login, CRUD, filtering, isolation and write protection.');
} finally {
	if (userId) await call(`/api/users/${userId}`, 'DELETE', undefined, cookie);
	if (songId) await call(`/api/songs/${songId}`, 'DELETE', undefined, cookie);
	if (tagId) await call(`/api/tags/${tagId}`, 'DELETE', undefined, cookie);
	if (collectionId) await call(`/api/collections/${collectionId}`, 'DELETE', undefined, cookie);
}
