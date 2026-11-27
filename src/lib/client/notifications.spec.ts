import { afterEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { notifications, notifyTransient, toasts } from './notifications.js';

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	notifications.set([]);
	toasts.set([]);
});

describe('transient notifications', () => {
	it('shows a saved toast temporarily without adding it to notification history', () => {
		vi.useFakeTimers();
		notifications.set([]);
		toasts.set([]);
		notifyTransient('success', 'Guardado.');
		expect(get(notifications)).toEqual([]);
		expect(get(toasts).map((entry) => entry.title)).toEqual(['Guardado.']);
		vi.advanceTimersByTime(6000);
		expect(get(toasts)).toEqual([]);
	});

	it('creates distinct local IDs when browser crypto.randomUUID is unavailable', () => {
		vi.useFakeTimers();
		vi.stubGlobal('crypto', undefined);
		notifyTransient('success', 'Primera');
		notifyTransient('success', 'Segunda');
		const ids = get(toasts).map((entry) => entry.id);
		expect(ids).toHaveLength(2);
		expect(ids[0]).not.toBe(ids[1]);
		expect(ids.every((id) => id.startsWith('local-'))).toBe(true);
	});
});
