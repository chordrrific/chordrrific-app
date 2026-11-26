import type { Notation } from '#lib/core/viewer-preferences.js';
import { offsetForTone, type SongKey } from './viewer-music.js';

export interface GeneralViewerSettings {
	tone: 'original' | number;
	notation: Notation;
}

// The account settings interface can replace these values later.
export const generalViewerSettings: GeneralViewerSettings = {
	tone: 'original',
	notation: 'solfege'
};

export function generalToneOffset(original: SongKey): number {
	return generalViewerSettings.tone === 'original'
		? 0
		: offsetForTone(original, generalViewerSettings.tone);
}
