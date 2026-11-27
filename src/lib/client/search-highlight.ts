import Fuse from 'fuse.js';

export interface HighlightPart {
	text: string;
	matched: boolean;
}

interface Range {
	start: number;
	end: number;
}

function fold(value: string): string {
	return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}

function foldedText(value: string): { text: string; starts: number[]; ends: number[] } {
	let text = '';
	let offset = 0;
	const starts: number[] = [];
	const ends: number[] = [];
	for (const character of value) {
		const start = offset;
		offset += character.length;
		const normalized = fold(character);
		if (!normalized && ends.length) ends[ends.length - 1] = offset;
		for (let index = 0; index < normalized.length; index += 1) {
			text += normalized[index];
			starts.push(start);
			ends.push(offset);
		}
	}
	return { text, starts, ends };
}

function exactRanges(value: string, token: string): Range[] {
	const folded = foldedText(value);
	const needle = fold(token);
	if (!needle) return [];
	const ranges: Range[] = [];
	let from = 0;
	for (
		let index = folded.text.indexOf(needle, from);
		index >= 0;
		index = folded.text.indexOf(needle, from)
	) {
		ranges.push({ start: folded.starts[index], end: folded.ends[index + needle.length - 1] });
		from = index + 1;
	}
	return ranges;
}

function fuzzyRanges(value: string, token: string): Range[] {
	const foldedToken = fold(token);
	if (foldedToken.length < 4) return [];
	const minimumLength = Math.max(3, foldedToken.length - 2);
	if (fold(value).length < minimumLength) return [];
	const fuse = new Fuse([{ text: value }], {
		keys: ['text'],
		includeMatches: true,
		findAllMatches: true,
		ignoreDiacritics: true,
		ignoreLocation: true,
		threshold: 0.35,
		minMatchCharLength: minimumLength
	});
	return (
		fuse
			.search(token)[0]
			?.matches?.flatMap((match) =>
				match.indices
					.filter(([start, end]) => end - start + 1 >= minimumLength)
					.map(([start, end]) => ({ start, end: end + 1 }))
			) ?? []
	);
}

function mergeRanges(ranges: Range[]): Range[] {
	const merged: Range[] = [];
	for (const range of ranges.sort((a, b) => a.start - b.start || a.end - b.end)) {
		const previous = merged.at(-1);
		if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
		else merged.push({ ...range });
	}
	return merged;
}

function matchRanges(value: string, query: string): Range[] {
	if (!value || !query.trim()) return [];
	const ranges: Range[] = [];
	for (const token of query.trim().split(/\s+/u)) {
		const exact = exactRanges(value, token);
		ranges.push(...(exact.length ? exact : fuzzyRanges(value, token)));
	}
	return mergeRanges(ranges);
}

function splitParts(value: string, ranges: Range[]): HighlightPart[] {
	const parts: HighlightPart[] = [];
	let cursor = 0;
	for (const range of ranges) {
		if (range.start > cursor)
			parts.push({ text: value.slice(cursor, range.start), matched: false });
		parts.push({ text: value.slice(range.start, range.end), matched: true });
		cursor = range.end;
	}
	if (cursor < value.length || parts.length === 0)
		parts.push({ text: value.slice(cursor), matched: false });
	return parts;
}

export function highlightText(value: string, query: string): HighlightPart[] {
	return splitParts(value, matchRanges(value, query));
}

export function highlightSegmentedText(
	segments: readonly string[],
	query: string
): HighlightPart[][] {
	const ranges = matchRanges(segments.join(''), query);
	let offset = 0;
	return segments.map((segment) => {
		const local = ranges.flatMap((range) => {
			const start = Math.max(range.start, offset);
			const end = Math.min(range.end, offset + segment.length);
			return start < end ? [{ start: start - offset, end: end - offset }] : [];
		});
		offset += segment.length;
		return splitParts(segment, local);
	});
}
