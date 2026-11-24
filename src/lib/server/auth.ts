import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { error, type RequestEvent } from '@sveltejs/kit';
import { db } from './db';

const cookieName = 'chordrrific_session';
const lifetime = 10 * 24 * 60 * 60 * 1000;

function hashSecret(secret: string): string {
	return createHash('sha256').update(secret).digest('hex');
}

function secretMatches(secret: string, storedHash: string): boolean {
	const actual = Buffer.from(hashSecret(secret), 'hex');
	const expected = Buffer.from(storedHash, 'hex');
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function startSession(event: RequestEvent, userId: string): Promise<void> {
	const id = randomBytes(16).toString('hex');
	const secret = randomBytes(32).toString('base64url');
	await db.session.create({ data: { id, userId, secretHash: hashSecret(secret) } });
	event.cookies.set(cookieName, `${id}.${secret}`, {
		path: '/',
		httpOnly: true,
		secure: event.url.protocol === 'https:',
		sameSite: 'lax',
		maxAge: lifetime / 1000
	});
}

export async function endSession(event: RequestEvent): Promise<void> {
	const token = event.cookies.get(cookieName);
	if (token) {
		const [id, secret, extra] = token.split('.');
		if (id && secret && !extra) {
			const session = await db.session.findUnique({ where: { id }, select: { secretHash: true } });
			if (session && secretMatches(secret, session.secretHash)) {
				await db.session.delete({ where: { id } });
			}
		}
	}
	event.cookies.delete(cookieName, { path: '/' });
}

export async function readSession(event: RequestEvent): Promise<App.Locals['user']> {
	const token = event.cookies.get(cookieName);
	if (!token) return null;
	const [id, secret, extra] = token.split('.');
	if (!id || !secret || extra) return null;
	const session = await db.session.findUnique({ where: { id }, include: { user: true } });
	if (!session || Date.now() - session.lastVerifiedAt.getTime() > lifetime) {
		if (session) await db.session.delete({ where: { id } });
		return null;
	}
	if (!secretMatches(secret, session.secretHash)) return null;
	if (Date.now() - session.lastVerifiedAt.getTime() > 60 * 60 * 1000) {
		await db.session.update({ where: { id }, data: { lastVerifiedAt: new Date() } });
	}
	return { id: session.user.id, email: session.user.email, isAdmin: session.user.isAdmin };
}

export function requireUser(event: RequestEvent): NonNullable<App.Locals['user']> {
	if (!event.locals.user) error(401, 'Sign in required');
	return event.locals.user;
}

export function requireAdmin(event: RequestEvent): NonNullable<App.Locals['user']> {
	const user = requireUser(event);
	if (!user.isAdmin) error(403, 'Administrator required');
	return user;
}
