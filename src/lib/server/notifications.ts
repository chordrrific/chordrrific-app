import { error } from '@sveltejs/kit';
import { cleanText, ValidationError } from '#lib/core/validation.js';
import { db } from './db.js';

export type NotificationKind = 'info' | 'success' | 'error';

export function listNotifications(ownerId: string) {
	return db.notification.findMany({ where: { ownerId }, orderBy: { createdAt: 'desc' } });
}

export function createNotification(ownerId: string, input: Record<string, unknown>) {
	if (input.kind !== 'info' && input.kind !== 'success' && input.kind !== 'error') {
		throw new ValidationError('Invalid notification kind');
	}
	const title = cleanText(input.title, 'Title', 120);
	const body = typeof input.body === 'string' ? input.body : '';
	if (body.length > 20_000) throw new ValidationError('Notification body is too long');
	return db.notification.create({ data: { ownerId, kind: input.kind, title, body } });
}

export async function markNotificationRead(ownerId: string, id: string) {
	const result = await db.notification.updateMany({
		where: { id, ownerId },
		data: { readAt: new Date() }
	});
	if (result.count === 0) error(404, 'Notification not found');
	return db.notification.findUniqueOrThrow({ where: { id } });
}

export async function deleteNotification(ownerId: string, id: string) {
	const result = await db.notification.deleteMany({ where: { id, ownerId } });
	if (result.count === 0) error(404, 'Notification not found');
}
