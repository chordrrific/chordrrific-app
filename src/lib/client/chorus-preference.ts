import { writable } from 'svelte/store';
import type { ChorusMode } from './song-preview.js';

const storageKey = 'chordrrific-chorus-mode';
export const chorusMode = writable<ChorusMode>('label');

export function initChorusMode(): void {
	chorusMode.set(localStorage.getItem(storageKey) === 'expanded' ? 'expanded' : 'label');
}

export function setChorusMode(value: ChorusMode): void {
	chorusMode.set(value);
	localStorage.setItem(storageKey, value);
}
