import { writable } from 'svelte/store';

export const zoomLevels = [75, 85, 100, 115, 130, 150, 175] as const;
export type ViewerZoom = (typeof zoomLevels)[number];

const storageKey = 'chordrrific-viewer-zoom';
export const viewerZoom = writable<ViewerZoom>(100);

function isViewerZoom(value: number): value is ViewerZoom {
	return zoomLevels.some((level) => level === value);
}

export function initViewerZoom(): void {
	const saved = Number(localStorage.getItem(storageKey));
	viewerZoom.set(isViewerZoom(saved) ? saved : 100);
}

export function setViewerZoom(value: ViewerZoom): void {
	viewerZoom.set(value);
	localStorage.setItem(storageKey, String(value));
}
