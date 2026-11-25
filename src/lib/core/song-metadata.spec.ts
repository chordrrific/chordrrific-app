import { describe, expect, it } from 'vitest';
import { replaceSongTags, songMetadata } from './song-metadata.js';

describe('ChordPro metadata', () => {
	it('reads repeated tags and card/filter fields from standalone directives', () => {
		const metadata = songMetadata(
			'{title: Test}\n{artist: Amaral}\n{album: Pájaros}\n{year: 2008}\n{tag: Pop}\n{tag: pop}\n{tag: Directo}\nLa [C]voz'
		);
		expect(metadata.artist).toEqual(['Amaral']);
		expect(metadata.album).toEqual(['Pájaros']);
		expect(metadata.year).toEqual(['2008']);
		expect(metadata.tag).toEqual(['Pop', 'Directo']);
	});
	it('replaces tag directives in the saved ChordPro while preserving lyrics', () => {
		const content = '{title: Test}\n{tag: Vieja}\n{key: C}\n[C]Letra';
		const updated = replaceSongTags(content, ['Nueva', 'nueva', 'Otra']);
		expect(updated).toBe('{title: Test}\n{tag: Nueva}\n{tag: Otra}\n{key: C}\n[C]Letra');
		expect(replaceSongTags(updated, ['Nueva', 'Otra'])).toBe(updated);
		expect(songMetadata(updated).tag).toEqual(['Nueva', 'Otra']);
	});
});
