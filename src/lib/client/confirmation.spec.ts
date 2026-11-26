import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { confirmAction, confirmation, resolveConfirmation } from './confirmation.js';

describe('shared confirmation', () => {
	it('shows the requested message and resolves cancellation', async () => {
		const result = confirmAction('¿Eliminar?', { destructive: true });
		expect(get(confirmation)).toEqual({
			message: '¿Eliminar?',
			confirmLabel: 'Aceptar',
			cancelLabel: 'Cancelar',
			destructive: true
		});
		resolveConfirmation(false);
		await expect(result).resolves.toBe(false);
		expect(get(confirmation)).toBeNull();
	});

	it('keeps the current request when another action arrives, then resolves acceptance', async () => {
		const result = confirmAction('Primera');
		await expect(confirmAction('Segunda')).resolves.toBe(false);
		expect(get(confirmation)?.message).toBe('Primera');
		resolveConfirmation(true);
		await expect(result).resolves.toBe(true);
	});
});
