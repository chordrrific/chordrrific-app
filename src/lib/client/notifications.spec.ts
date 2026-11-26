import { afterEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { notifications, notifyTransient, toasts } from './notifications.js';

afterEach(() => {
	vi.useRealTimers();
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
});
