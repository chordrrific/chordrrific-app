import { cleanSongContent, cleanText, ValidationError } from './validation.js';

const titleDirective = /(?:^|\r?\n)[ \t]*\{(?:title|t)(?:\s*:\s*|\s+)([^}\r\n]*)\}/i;

export function titleFromChordPro(content: unknown): string {
	const source = cleanSongContent(content);
	const title = titleDirective.exec(source)?.[1];
	if (title === undefined) throw new ValidationError('Add a {title: ...} directive before saving');
	return cleanText(title, 'Title', 160);
}

export function hasTitleDirective(content: string): boolean {
	return Boolean(titleDirective.exec(content)?.[1].trim());
}
