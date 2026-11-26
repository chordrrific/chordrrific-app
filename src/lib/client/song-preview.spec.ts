import * as library from 'chordsheetjs';
import { describe, expect, it } from 'vitest';
import {
	renderSongPreview,
	defaultBisDisplayConfig,
	type PreviewBis,
	type PreviewBlock,
	type PreviewLine,
	type PreviewPart,
	type SongPreview
} from './song-preview.js';

type Section = Extract<PreviewBlock, { kind: 'section' }>;

function sections(preview: SongPreview): Section[] {
	return preview.blocks.filter((block): block is Section => block.kind === 'section');
}

function partLines(parts: PreviewPart[]): PreviewLine[] {
	return parts.flatMap((part) => (part.kind === 'line' ? [part] : partLines(part.parts)));
}

function lines(section: Section): PreviewLine[] {
	return partLines(section.parts);
}

function lyrics(section: Section): string {
	return lines(section)
		.map((line) => line.segments.map((segment) => segment.lyrics).join(''))
		.join('\n');
}

function chords(section: Section): string[] {
	return lines(section).flatMap((line) =>
		line.segments.map((segment) => segment.chord).filter(Boolean)
	);
}

function bis(section: Section): PreviewBis[] {
	return section.parts.filter((part): part is PreviewBis => part.kind === 'bis');
}

describe('song preview', () => {
	it('renders absolute solfege without a key and preserves written accidentals', () => {
		const preview = renderSongPreview(library, '[C]Do [F#]Fa [Bb]Si', 'solfege', 0);
		expect(preview.error).toBeNull();
		expect(preview.hasKey).toBe(false);
		expect(preview.hasChords).toBe(true);
		expect(chords(sections(preview)[0])).toEqual(['Do', 'Fa#', 'Sib']);
	});
	it('identifies a song with no chords even when it has a key directive', () => {
		const preview = renderSongPreview(
			library,
			'{title: Solo letra}\n{key: C}\nUna estrofa',
			'symbol',
			0
		);
		expect(preview.error).toBeNull();
		expect(preview.hasKey).toBe(true);
		expect(preview.hasChords).toBe(false);
	});

	it('converts solfege source chords to symbols without a key', () => {
		const preview = renderSongPreview(library, '[Do]Hola [Fa]mundo', 'symbol', 0);
		expect(preview.error).toBeNull();
		expect(chords(sections(preview)[0])).toEqual(['C', 'F']);
	});

	it('keeps lyrics contiguous when chords split words', () => {
		const preview = renderSongPreview(library, 'Al[D]egria, alegria, alegri[A]a,', 'symbol', 0);
		expect(lyrics(sections(preview)[0])).toBe('Alegria, alegria, alegria,');
	});

	it('reports incomplete input and recovers when it is complete', () => {
		const invalid = renderSongPreview(library, '{', 'symbol', 0);
		expect(invalid.error).toContain('end of input');
		expect(invalid.blocks).toEqual([]);

		const valid = renderSongPreview(library, '{key: C}\n[C]Hola', 'solfege', 0);
		expect(valid.error).toBeNull();
		expect(valid.hasKey).toBe(true);
		expect(chords(sections(valid)[0])).toEqual(['Do']);
	});

	it('requires a key for Nashville notation', () => {
		expect(renderSongPreview(library, '[C]Hola', 'number', 0).error).toContain('{key: ...}');
		const preview = renderSongPreview(library, '{key: C}\n[C]Hola', 'number', 0);
		expect(chords(sections(preview)[0])).toEqual(['1']);
	});

	it('shows a chorus reference as a label by default', () => {
		const content = '{title: Test}\n{start_of_chorus}\n[C]Uno\n{end_of_chorus}\n\n{chorus}';
		const preview = renderSongPreview(library, content, 'symbol', 0);
		expect(preview.title).toBe('Test');
		expect(preview.blocks.map((block) => block.kind)).toEqual(['section', 'chorus-label']);
		const [original, reference] = preview.blocks;
		expect(original.kind).toBe('section');
		expect(reference.kind).toBe('chorus-label');
		if (original.kind !== 'section' || reference.kind !== 'chorus-label') return;
		expect(reference.targetSourceIndex).toBe(original.sourceIndex);
		expect(lyrics(sections(preview)[0])).toBe('Uno');
	});
	it('hides chorus references without changing the chorus content', () => {
		const content =
			'{title: Test}\n{start_of_chorus}\n[C]Uno\n{end_of_chorus}\n{chorus}\n{chorus: Missing}';
		const preview = renderSongPreview(library, content, 'symbol', 0, 'hidden');
		expect(preview.error).toBeNull();
		expect(preview.blocks.map((block) => block.kind)).toEqual(['section']);
		expect(chords(sections(preview)[0])).toEqual(['C']);
	});

	it('expands a chorus reference visually and transposes its chords', () => {
		const content = '{key: C}\n{start_of_chorus}\n[C]Uno\n{end_of_chorus}\n\n{chorus}';
		const preview = renderSongPreview(library, content, 'solfege', 2, 'expanded');
		const [original, repeated] = sections(preview);
		expect(preview.error).toBeNull();
		expect(original.recalled).toBe(false);
		expect(repeated.recalled).toBe(true);
		expect(repeated.targetSourceIndex).toBe(original.sourceIndex);
		expect(lyrics(repeated)).toBe('Uno');
		expect(chords(repeated)).toEqual(['Re']);
	});

	it('expands and collapses individual references without changing their targets', () => {
		const content =
			'{start_of_chorus: One}\n[C]Primero\n{end_of_chorus}\n' +
			'{start_of_chorus: Two}\n[D]Segundo\n{end_of_chorus}\n' +
			'{chorus: One}\n{chorus: Two}';
		const collapsed = renderSongPreview(library, content, 'symbol', 0);
		const labels = collapsed.blocks.filter((block) => block.kind === 'chorus-label');
		expect(labels).toHaveLength(2);
		expect(labels[0].targetSourceIndex).toBe(sections(collapsed)[0].sourceIndex);
		expect(labels[1].targetSourceIndex).toBe(sections(collapsed)[1].sourceIndex);

		const firstOnly = renderSongPreview(
			library,
			content,
			'symbol',
			0,
			'label',
			defaultBisDisplayConfig,
			{ [labels[0].sourceIndex]: 'expanded' }
		);
		expect(firstOnly.blocks.map((block) => block.kind)).toEqual([
			'section',
			'section',
			'section',
			'chorus-label'
		]);
		expect(sections(firstOnly)[2].targetSourceIndex).toBe(labels[0].targetSourceIndex);
		expect(lyrics(sections(firstOnly)[2])).toBe('Primero');

		const secondCollapsed = renderSongPreview(
			library,
			content,
			'symbol',
			0,
			'expanded',
			defaultBisDisplayConfig,
			{ [labels[1].sourceIndex]: 'label' }
		);
		expect(secondCollapsed.blocks.map((block) => block.kind)).toEqual([
			'section',
			'section',
			'section',
			'chorus-label'
		]);
		expect(sections(secondCollapsed)[2].targetSourceIndex).toBe(labels[0].targetSourceIndex);
	});

	it('reports a missing chorus in collapsed mode instead of rendering a broken link', () => {
		const preview = renderSongPreview(library, '{chorus: Missing}', 'symbol', 0);
		expect(preview.blocks).toEqual([{ kind: 'missing-chorus', label: 'Missing' }]);
	});

	it('uses the nearest preceding chorus for an unlabelled reference', () => {
		const content =
			'{start_of_chorus}\n[C]Primero\n{end_of_chorus}\n\n' +
			'{start_of_chorus}\n[D]Segundo\n{end_of_chorus}\n\n{chorus}';
		const preview = renderSongPreview(library, content, 'symbol', 0, 'expanded');
		expect(lyrics(sections(preview).at(-1)!)).toBe('Segundo');
	});

	it('uses the matching named chorus even after another chorus', () => {
		const content =
			'{start_of_chorus: Chorus 2}\n[C]Dos\n{end_of_chorus}\n\n' +
			'{start_of_chorus: Chorus 3}\n[D]Tres\n{end_of_chorus}\n\n' +
			'{chorus: Chorus 2}';
		const preview = renderSongPreview(library, content, 'symbol', 0, 'expanded');
		expect(lyrics(sections(preview).at(-1)!)).toBe('Dos');
	});

	it('accepts the explicit label attribute for named references', () => {
		const content =
			'{start_of_chorus: label="Chorus 2"}\n[C]Dos\n{end_of_chorus}\n\n' +
			'{chorus: label="Chorus 2"}';
		const preview = renderSongPreview(library, content, 'symbol', 0, 'expanded');
		expect(lyrics(sections(preview).at(-1)!)).toBe('Dos');
	});

	it('includes comments inside an expanded chorus', () => {
		const content =
			'{start_of_chorus}\n[C]Uno\n{comment: Suave}\n[D]Dos\n{end_of_chorus}\n\n{chorus}';
		const preview = renderSongPreview(library, content, 'symbol', 0, 'expanded');
		const repeated = sections(preview).at(-1)!;
		expect(lyrics(repeated)).toBe('Uno\nSuave\nDos');
		expect(lines(repeated)[1].comment).toBe(true);
	});

	it('shows an inline message when an expanded reference cannot be resolved', () => {
		const preview = renderSongPreview(library, '{chorus: Missing}', 'symbol', 0, 'expanded');
		expect(preview.blocks).toEqual([{ kind: 'missing-chorus', label: 'Missing' }]);
	});

	it('keeps an unparameterized bis inside its verse', () => {
		const content =
			'{start_of_verse}\n[E]Dim dom\nRep[B7]ican las camp[E]anas.\n' +
			'{x_start_of_bis}\nDim dom\nLleg[B7]ó la Navi[E]dad.\n{x_end_of_bis}\n{end_of_verse}';
		const preview = renderSongPreview(library, content, 'symbol', 0);
		const verse = sections(preview)[0];
		expect(preview.error).toBeNull();
		expect(verse.section).toBe('verse');
		expect(verse.parts.map((part) => part.kind)).toEqual(['line', 'line', 'bis']);
		expect(bis(verse)[0].marker).toBe('(bis)');
		expect(bis(verse)[0].label).toBeNull();
		expect(lyrics(verse)).toBe('Dim dom\nRepican las campanas.\nDim dom\nLlegó la Navidad.');
	});

	it('uses a numeric repeat and preserves the label as text', () => {
		const content =
			'{x_start_of_bis repeat="3" label="<script>alert(1)</script>"}\n[C]Uno\n{x_end_of_bis}';
		const preview = renderSongPreview(library, content, 'symbol', 0);
		const group = bis(sections(preview)[0])[0];
		expect(group.repeat).toBe(3);
		expect(group.marker).toBe('(x3)');
		expect(group.label).toBe('<script>alert(1)</script>');
	});

	it('allows the bis marker text to be configured', () => {
		const config = { defaultMarker: 'Again', repeatMarkerTemplate: 'Play {count} times' };
		const plain = renderSongPreview(
			library,
			'{x_start_of_bis}\n[C]Uno\n{x_end_of_bis}',
			'symbol',
			0,
			'label',
			config
		);
		const counted = renderSongPreview(
			library,
			'{x_start_of_bis repeat="2"}\n[C]Uno\n{x_end_of_bis}',
			'symbol',
			0,
			'label',
			config
		);
		expect(bis(sections(plain)[0])[0].marker).toBe('Again');
		expect(bis(sections(counted)[0])[0].marker).toBe('Play 2 times');
	});

	it('repeats bis blocks when a chorus is expanded', () => {
		const content =
			'{start_of_chorus}\n[C]Uno\n' +
			'{x_start_of_bis repeat="2" label="Tenores"}\n[D]Dos\n{x_end_of_bis}\n' +
			'{end_of_chorus}\n\n{chorus}';
		const preview = renderSongPreview(library, content, 'solfege', 0, 'expanded');
		const repeated = sections(preview).at(-1)!;
		expect(repeated.recalled).toBe(true);
		expect(bis(repeated)[0].marker).toBe('(x2)');
		expect(bis(repeated)[0].label).toBe('Tenores');
		expect(chords(repeated)).toEqual(['Do', 'Re']);
	});

	it('nests one bis inside another and keeps the outer span around it', () => {
		const content =
			'{start_of_verse}\n[A]Antes\n' +
			'{x_start_of_bis repeat="2" label="Todos"}\n[B]Exterior\n' +
			'{x_start_of_bis repeat="3" label="Tenores"}\n[C]Interior\n{x_end_of_bis}\n' +
			'[D]Exterior otra\n{x_end_of_bis}\n[E]Después\n{end_of_verse}';
		const preview = renderSongPreview(library, content, 'symbol', 0);
		const verse = sections(preview)[0];
		const outer = bis(verse)[0];
		const inner = outer.parts[1];
		expect(preview.error).toBeNull();
		expect(verse.parts.map((part) => part.kind)).toEqual(['line', 'bis', 'line']);
		expect(outer.parts.map((part) => part.kind)).toEqual(['line', 'bis', 'line']);
		expect(outer.marker).toBe('(x2)');
		expect(outer.label).toBe('Todos');
		expect(inner.kind).toBe('bis');
		if (inner.kind !== 'bis') throw new Error('Expected inner bis');
		expect(inner.marker).toBe('(x3)');
		expect(inner.label).toBe('Tenores');
		expect(lyrics(verse)).toBe('Antes\nExterior\nInterior\nExterior otra\nDespués');
	});

	it('preserves nested bis blocks in an expanded chorus', () => {
		const content =
			'{start_of_chorus}\n{x_start_of_bis}\n[A]Outer\n' +
			'{x_start_of_bis}\n[B]Inner\n{x_end_of_bis}\n{x_end_of_bis}\n' +
			'{end_of_chorus}\n\n{chorus}';
		const preview = renderSongPreview(library, content, 'symbol', 0, 'expanded');
		const repeated = sections(preview).at(-1)!;
		const outer = bis(repeated)[0];
		expect(repeated.recalled).toBe(true);
		expect(outer.parts[1].kind).toBe('bis');
		expect(lyrics(repeated)).toBe('Outer\nInner');
	});

	it('reports a third bis level as a preview error', () => {
		const content =
			'{x_start_of_bis}\n{x_start_of_bis}\n{x_start_of_bis}\n[A]Too deep\n' +
			'{x_end_of_bis}\n{x_end_of_bis}\n{x_end_of_bis}';
		const preview = renderSongPreview(library, content, 'symbol', 0);
		expect(preview.error).toContain('at most two nested levels');
		expect(preview.blocks).toEqual([]);
	});

	it('reports invalid or unbalanced bis directives without crashing the preview', () => {
		expect(
			renderSongPreview(
				library,
				'{x_start_of_bis repeat="two"}\n[C]Uno\n{x_end_of_bis}',
				'symbol',
				0
			).error
		).toContain('positive integer');
		expect(renderSongPreview(library, '{x_start_of_bis}\n[C]Uno', 'symbol', 0).error).toContain(
			'Missing {x_end_of_bis}'
		);
		expect(renderSongPreview(library, '{x_end_of_bis}', 'symbol', 0).error).toContain(
			'Unexpected {x_end_of_bis}'
		);
	});

	it('ignores unrelated custom directives without adding blank paragraphs', () => {
		const preview = renderSongPreview(library, '[C]Uno\n{x_something: value}\n[D]Dos', 'symbol', 0);
		expect(preview.error).toBeNull();
		expect(sections(preview)).toHaveLength(1);
		expect(lyrics(sections(preview)[0])).toBe('Uno\nDos');
	});
});
