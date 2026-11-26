import { writable } from 'svelte/store';
import { request } from './api.js';

export type NotificationKind = 'info' | 'success' | 'error';
export interface AppNotification {
	id: string;
	kind: NotificationKind;
	title: string;
	body: string;
	readAt: string | null;
	createdAt: string;
}

export const notifications = writable<AppNotification[]>([]);
export const toastIds = writable<string[]>([]);
let activeUser: string | null = null;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export async function initializeNotifications(userId: string | null): Promise<void> {
	if (activeUser === userId) return;
	activeUser = userId;
	notifications.set([]);
	toastIds.set([]);
	for (const timer of timers.values()) clearTimeout(timer);
	timers.clear();
	if (!userId) return;
	try {
		const entries = await request<AppNotification[]>('/api/notifications');
		if (activeUser === userId)
			notifications.update((current) =>
				[
					...current,
					...entries.filter((entry) => !current.some((item) => item.id === entry.id))
				].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
			);
	} catch {
		// The page remains usable if notification history cannot be loaded.
	}
}

export function dismissToast(id: string): void {
	toastIds.update((current) => current.filter((item) => item !== id));
	const timer = timers.get(id);
	if (timer) clearTimeout(timer);
	timers.delete(id);
}

function showToast(entry: AppNotification): void {
	toastIds.update((current) => [entry.id, ...current].slice(0, 4));
	if (entry.kind !== 'error')
		timers.set(
			entry.id,
			setTimeout(() => dismissToast(entry.id), 6000)
		);
}

export async function notify(kind: NotificationKind, title: string, body = ''): Promise<void> {
	let entry: AppNotification;
	try {
		entry = await request<AppNotification>('/api/notifications', 'POST', { kind, title, body });
	} catch {
		entry = {
			id: `local-${crypto.randomUUID()}`,
			kind,
			title,
			body,
			readAt: null,
			createdAt: new Date().toISOString()
		};
	}
	notifications.update((current) => [entry, ...current]);
	showToast(entry);
}

export async function markRead(id: string): Promise<void> {
	if (!id.startsWith('local-')) await request(`/api/notifications/${id}`, 'PATCH');
	notifications.update((current) =>
		current.map((entry) =>
			entry.id === id ? { ...entry, readAt: new Date().toISOString() } : entry
		)
	);
}

export async function removeNotification(id: string): Promise<void> {
	if (!id.startsWith('local-')) await request(`/api/notifications/${id}`, 'DELETE');
	dismissToast(id);
	notifications.update((current) => current.filter((entry) => entry.id !== id));
}
