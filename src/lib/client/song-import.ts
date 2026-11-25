import { cleanSongContent, cleanText } from '#lib/core/validation.js';
import { hasTitleDirective, titleFromChordPro } from '#lib/core/song-title.js';

type ChordSheetLibrary = typeof import('chordsheetjs');

const extensions = ['.cho', '.crd', '.chopro', '.chord', '.pro', '.chordpro', '.txt'];
export const chordProFileAccept = extensions.join(',');

export interface NewSong {
	title: string;
	content: string;
}

export type SongImportResult =
	| { status: 'imported'; fileName: string; title: string; songId: string }
	| { status: 'failed'; fileName: string; error: string };

function errorMessage(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}

export async function prepareChordProFile(
	file: File,
	library: ChordSheetLibrary
): Promise<NewSong> {
	const extension = extensions.find((value) => file.name.toLowerCase().endsWith(value));
	if (!extension) throw new Error('Unsupported ChordPro file extension');

	const originalContent = await file.text();
	if (!originalContent.trim()) throw new Error('The file is empty');
	cleanSongContent(originalContent);
	new library.ChordProParser().parse(originalContent);
	const fallbackTitle = file.name.slice(0, -extension.length).replace(/[{}\r\n]/g, ' ');
	const existingTitle = hasTitleDirective(originalContent);
	const title = existingTitle
		? titleFromChordPro(originalContent)
		: cleanText(fallbackTitle, 'Title', 160);
	const content = existingTitle ? originalContent : `{title: ${title}}\n${originalContent}`;
	cleanSongContent(content);
	return { title, content };
}

export async function importChordProFiles(
	files: readonly File[],
	saveSong: (song: NewSong) => Promise<{ id: string; title: string }>,
	loadLibrary: () => Promise<ChordSheetLibrary> = () => import('chordsheetjs')
): Promise<SongImportResult[]> {
	if (files.length === 0) return [];

	let library: ChordSheetLibrary;
	try {
		library = await loadLibrary();
	} catch (cause) {
		return files.map((file) => ({
			status: 'failed',
			fileName: file.name,
			error: errorMessage(cause)
		}));
	}

	const results: SongImportResult[] = [];
	for (const file of files) {
		try {
			const prepared = await prepareChordProFile(file, library);
			const song = await saveSong(prepared);
			results.push({ status: 'imported', fileName: file.name, title: song.title, songId: song.id });
		} catch (cause) {
			results.push({ status: 'failed', fileName: file.name, error: errorMessage(cause) });
		}
	}
	return results;
}
