import { describe, expect, it } from 'vitest';
import { chordOffsets } from './chord-layout.js';

describe('chord placement', () => {
	it('keeps labels at their lyric anchors when there is room', () => {
		expect(
			chordOffsets(
				[
					{ left: 0, width: 25 },
					{ left: 40, width: 20 },
					{ left: 80, width: 30 }
				],
				4
			)
		).toEqual([0, 0, 0]);
	});

	it('moves later labels just enough to clear earlier ones', () => {
		expect(
			chordOffsets(
				[
					{ left: 100, width: 35 },
					{ left: 120, width: 20 },
					{ left: 135, width: 40 }
				],
				4
			)
		).toEqual([0, 19, 28]);
	});
});
