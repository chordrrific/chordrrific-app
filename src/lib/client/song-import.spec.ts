import * as library from 'chordsheetjs';
import { describe, expect, it, vi } from 'vitest';
import { importChordProFiles, prepareChordProFile } from './song-import.js';

describe('ChordPro import', () => {
	it('uses the ChordPro title and preserves the original text', async () => {
		const content = '{title: 25 de Diciembre}\n[Am]Venticinco de Diciembre';
		const file = new File([content], 'another-name.cho');
		expect(await prepareChordProFile(file, library)).toEqual({
			title: '25 de Diciembre',
			content
		});
		expect(await file.text()).toBe(content);
	});

	it('uses the filename when title is absent or blank', async () => {
		const untitled = new File(['[C]Hola'], 'mi.canción.CHORDPRO');
		const blankTitle = new File(['{title:   }\n[C]Hola'], 'villancico.cho');
		expect((await prepareChordProFile(untitled, library)).title).toBe('mi.canción');
		expect((await prepareChordProFile(blankTitle, library)).title).toBe('villancico');
	});

	it('continues after individual file and API failures and reports each result', async () => {
		const files = [
			new File(['{t: Primero}\n[C]Uno'], 'one.cho'),
			new File(['{title'], 'broken.crd'),
			new File(['[C]Wrong extension'], 'wrong.pdf'),
			new File(['[D]Dos'], 'second.chopro'),
			new File(['[E]Tres'], 'server-fails.pro')
		];
		const saveSong = vi.fn(async (song: { title: string; content: string }) => {
			if (song.title === 'server-fails') throw new Error('Database unavailable');
			return { id: song.title, title: song.title };
		});
		const results = await importChordProFiles(files, saveSong, async () => library);

		expect(results.map((result) => result.status)).toEqual([
			'imported',
			'failed',
			'failed',
			'imported',
			'failed'
		]);
		expect(results[0]).toEqual({
			status: 'imported',
			fileName: 'one.cho',
			title: 'Primero',
			songId: 'Primero'
		});
		expect(results[1]).toMatchObject({ status: 'failed', fileName: 'broken.crd' });
		expect(results[2]).toEqual({
			status: 'failed',
			fileName: 'wrong.pdf',
			error: 'Unsupported ChordPro file extension'
		});
		expect(results[4]).toEqual({
			status: 'failed',
			fileName: 'server-fails.pro',
			error: 'Database unavailable'
		});
		expect(saveSong).toHaveBeenCalledTimes(3);
		expect(await files[0].text()).toBe('{t: Primero}\n[C]Uno');
	});

	it('reports empty files and a library load failure', async () => {
		const empty = new File([''], 'empty.cho');
		const saveSong = vi.fn(async () => ({ id: 'unused', title: 'unused' }));
		const [emptyResult] = await importChordProFiles([empty], saveSong, async () => library);
		expect(emptyResult).toEqual({
			status: 'failed',
			fileName: 'empty.cho',
			error: 'The file is empty'
		});
		expect(saveSong).not.toHaveBeenCalled();

		const [loadFailure] = await importChordProFiles([empty], saveSong, async () => {
			throw new Error('Parser unavailable');
		});
		expect(loadFailure).toMatchObject({ status: 'failed', error: 'Parser unavailable' });
	});
});
