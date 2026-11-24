import { cleanSongContent, cleanText } from '#lib/core/validation.js';

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

	const content = await file.text();
	if (!content.trim()) throw new Error('The file is empty');
	cleanSongContent(content);
	const song = new library.ChordProParser().parse(content);
	const fallbackTitle = file.name.slice(0, -extension.length);
	const metadataTitle = song.getSingleMetadataValue('title')?.trim();
	const title = cleanText(metadataTitle || fallbackTitle, 'Title', 160);
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
