import { ValidationError } from './validation.js';

export const viewerNotations = [
	'symbol',
	'solfege',
	'special-solfege',
	'number',
	'roman',
	'hidden'
] as const;
export type Notation = (typeof viewerNotations)[number];
export const chorusModes = ['label', 'expanded', 'hidden'] as const;
export type ChorusMode = (typeof chorusModes)[number];

export interface SongViewerPins {
	pinnedTone: number | null;
	pinnedNotation: Notation | null;
	pinnedChorusMode: ChorusMode | null;
}

export type SongViewerPinUpdate = Partial<SongViewerPins>;

export function cleanSongViewerPins(input: Record<string, unknown>): SongViewerPinUpdate {
	const pins: SongViewerPinUpdate = {};
	if ('pinnedTone' in input) {
		const value = input.pinnedTone;
		if (
			value !== null &&
			(typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 11)
		) {
			throw new ValidationError('Pinned tone must be a pitch class from 0 to 11 or null');
		}
		pins.pinnedTone = value;
	}
	if ('pinnedNotation' in input) {
		const value = input.pinnedNotation;
		if (value !== null && !viewerNotations.some((notation) => notation === value)) {
			throw new ValidationError('Pinned notation is invalid');
		}
		pins.pinnedNotation = value as Notation | null;
	}
	if ('pinnedChorusMode' in input) {
		const value = input.pinnedChorusMode;
		if (value !== null && !chorusModes.some((mode) => mode === value)) {
			throw new ValidationError('Pinned chorus mode is invalid');
		}
		pins.pinnedChorusMode = value as ChorusMode | null;
	}
	return pins;
}
