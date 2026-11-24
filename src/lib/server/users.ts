import argon2 from 'argon2';
import { error } from '@sveltejs/kit';
import { cleanEmail, cleanPassword, ValidationError } from '#lib/core/validation.js';
import { db } from './db';

const publicUser = { id: true, email: true, isAdmin: true, createdAt: true } as const;

export async function authenticate(emailInput: unknown, password: unknown) {
	const email = cleanEmail(emailInput);
	if (typeof password !== 'string') error(401, 'Invalid credentials');
	const user = await db.user.findUnique({ where: { email } });
	if (!user || !(await argon2.verify(user.passwordHash, password)))
		error(401, 'Invalid credentials');
	return user;
}

export function listUsers() {
	return db.user.findMany({ select: publicUser, orderBy: { email: 'asc' } });
}

export async function createUser(input: Record<string, unknown>) {
	if (input.isAdmin !== undefined && typeof input.isAdmin !== 'boolean') {
		throw new ValidationError('isAdmin must be a boolean');
	}
	return db.user.create({
		data: {
			email: cleanEmail(input.email),
			passwordHash: await argon2.hash(cleanPassword(input.password)),
			isAdmin: input.isAdmin === true
		},
		select: publicUser
	});
}

export async function changeOwnPassword(userId: string, current: unknown, next: unknown) {
	const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
	if (typeof current !== 'string' || !(await argon2.verify(user.passwordHash, current))) {
		error(403, 'Current password is incorrect');
	}
	await db.$transaction([
		db.user.update({
			where: { id: userId },
			data: { passwordHash: await argon2.hash(cleanPassword(next)) }
		}),
		db.session.deleteMany({ where: { userId } })
	]);
}

export async function updateUser(id: string, input: Record<string, unknown>) {
	if (input.isAdmin !== undefined && typeof input.isAdmin !== 'boolean') {
		throw new ValidationError('isAdmin must be a boolean');
	}
	const requestedAdmin = typeof input.isAdmin === 'boolean' ? input.isAdmin : undefined;
	const passwordHash =
		input.password === undefined ? undefined : await argon2.hash(cleanPassword(input.password));
	const email = input.email === undefined ? undefined : cleanEmail(input.email);
	return db.$transaction(async (tx) => {
		const target = await tx.user.findUnique({ where: { id } });
		if (!target) error(404, 'User not found');
		const isAdmin = requestedAdmin ?? target.isAdmin;
		if (target.isAdmin && !isAdmin && (await tx.user.count({ where: { isAdmin: true } })) === 1) {
			error(409, 'The last administrator cannot be demoted');
		}
		const user = await tx.user.update({
			where: { id },
			data: { email, isAdmin, passwordHash },
			select: publicUser
		});
		if (passwordHash || target.isAdmin !== isAdmin)
			await tx.session.deleteMany({ where: { userId: id } });
		return user;
	});
}

export async function deleteUser(id: string) {
	await db.$transaction(async (tx) => {
		const target = await tx.user.findUnique({ where: { id } });
		if (!target) error(404, 'User not found');
		if (target.isAdmin && (await tx.user.count({ where: { isAdmin: true } })) === 1) {
			error(409, 'The last administrator cannot be deleted');
		}
		await tx.user.delete({ where: { id } });
	});
}
