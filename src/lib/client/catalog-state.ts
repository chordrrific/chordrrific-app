import { writable } from 'svelte/store';

export const catalogRevision = writable(0);

export function refreshCatalog(): void {
	catalogRevision.update((revision) => revision + 1);
}
