import { request } from './api.js';
import { t, type Locale } from './i18n.js';
import { notify } from './notifications.js';
import { importChordProFiles } from './song-import.js';
import type { Song } from './types.js';

export async function importSongsWithReport(
	files: readonly File[],
	language: Locale
): Promise<number> {
	try {
		const results = await importChordProFiles(files, (song) =>
			request<Song>('/api/songs', 'POST', song)
		);
		const imported = results.filter((result) => result.status === 'imported').length;
		const failed = results.length - imported;
		const report = results
			.map((result) =>
				result.status === 'imported'
					? `${result.fileName} → ${result.title}`
					: `${result.fileName}: ${result.error}`
			)
			.join('\n');
		const body = report.length > 20_000 ? `${report.slice(0, 19_999)}…` : report;
		await notify(
			failed ? 'error' : 'success',
			`${t(language, 'importedCount')}: ${imported} · ${t(language, 'failedCount')}: ${failed}`,
			body
		);
		return imported;
	} catch (cause) {
		void notify(
			'error',
			t(language, 'importSummary'),
			cause instanceof Error ? cause.message : String(cause)
		);
		return 0;
	}
}
