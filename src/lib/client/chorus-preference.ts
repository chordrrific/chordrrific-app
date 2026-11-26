import { writable } from 'svelte/store';
import type { ChorusMode } from './song-preview.js';

const storageKey = 'chordrrific-chorus-mode';
export const chorusMode = writable<ChorusMode>('label');

export function initChorusMode(): void {
	const saved = localStorage.getItem(storageKey);
	chorusMode.set(saved === 'expanded' || saved === 'hidden' ? saved : 'label');
}

export function setChorusMode(value: ChorusMode): void {
	chorusMode.set(value);
	localStorage.setItem(storageKey, value);
}
