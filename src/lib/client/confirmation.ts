import { get, writable } from 'svelte/store';
import { locale, t } from './i18n.js';

export interface ConfirmationRequest {
	message: string;
	confirmLabel: string;
	cancelLabel: string;
	destructive: boolean;
}

export const confirmation = writable<ConfirmationRequest | null>(null);
let pendingResolve: ((confirmed: boolean) => void) | null = null;

export function confirmAction(
	message: string,
	options: Partial<Pick<ConfirmationRequest, 'confirmLabel' | 'cancelLabel' | 'destructive'>> = {}
): Promise<boolean> {
	if (pendingResolve) return Promise.resolve(false);
	return new Promise<boolean>((resolve) => {
		pendingResolve = resolve;
		confirmation.set({
			message,
			confirmLabel: options.confirmLabel ?? t(get(locale), 'accept'),
			cancelLabel: options.cancelLabel ?? t(get(locale), 'cancel'),
			destructive: options.destructive ?? false
		});
	});
}

export function resolveConfirmation(confirmed: boolean): void {
	const resolve = pendingResolve;
	pendingResolve = null;
	confirmation.set(null);
	resolve?.(confirmed);
}
