import { cleanText } from './validation.js';

export const metadataKeys = [
	'artist',
	'composer',
	'lyricist',
	'album',
	'year',
	'key',
	'time',
	'tempo',
	'capo',
	'tag'
] as const;
export type MetadataKey = (typeof metadataKeys)[number];
export type SongMetadata = Record<MetadataKey, string[]>;

const metadataSet = new Set<string>(metadataKeys);
const lineDirective = /^[ \t]*\{([a-z_]+)(?:\s*:\s*|\s+)([^}\r\n]*)\}[ \t]*$/i;

function normalized(value: string): string {
	return value.toLocaleLowerCase();
}

export function songMetadata(content: string): SongMetadata {
	const values: SongMetadata = {
		artist: [],
		composer: [],
		lyricist: [],
		album: [],
		year: [],
		key: [],
		time: [],
		tempo: [],
		capo: [],
		tag: []
	};
	for (const line of content.split(/\r?\n/)) {
		const match = lineDirective.exec(line);
		if (!match) continue;
		const key = match[1].toLowerCase();
		if (!metadataSet.has(key)) continue;
		const value = match[2].trim();
		if (!value) continue;
		const list = values[key as MetadataKey];
		if (!list.some((current) => normalized(current) === normalized(value))) list.push(value);
	}
	return values;
}

export function replaceSongTags(content: string, names: readonly string[]): string {
	const tags: string[] = [];
	for (const name of names) {
		const tag = cleanText(name, 'Tag', 60);
		if (/[{}\r\n]/.test(tag)) throw new Error('Tag cannot contain braces or line breaks');
		if (!tags.some((current) => normalized(current) === normalized(tag))) tags.push(tag);
	}
	const lines = content.replaceAll('\r\n', '\n').split('\n');
	const withoutTags = lines.filter(
		(line) => !/^[ \t]*\{tag(?:\s*:\s*|\s+)[^}\r\n]*\}[ \t]*$/i.test(line)
	);
	const titleIndex = withoutTags.findIndex((line) =>
		/^[ \t]*\{(?:title|t)(?:\s*:\s*|\s+)[^}\r\n]*\}/i.test(line)
	);
	withoutTags.splice(titleIndex < 0 ? 0 : titleIndex + 1, 0, ...tags.map((tag) => `{tag: ${tag}}`));
	return withoutTags.join('\n');
}
