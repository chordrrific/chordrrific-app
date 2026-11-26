import { describe, expect, it } from 'vitest';
import {
	availableParameters,
	directiveNames,
	formatChordPro,
	insertDirective,
	matchingEnvironments,
	scanDirectives,
	suggestedClosingDirective,
	tabDestination,
	wrapEnvironment
} from './chordpro-language.js';

describe('ChordPro editor language', () => {
	it('offers canonical directive names, including all documented environments and custom bis', () => {
		expect(directiveNames('verse', null)).toEqual(['start_of_verse', 'end_of_verse']);
		expect(directiveNames('', null, true)).toContain('start_of_abc');
		expect(directiveNames('', null, true)).toContain('x_start_of_bis');
		expect(directiveNames('', null)).not.toContain('t');
		expect(directiveNames('start_of_refrain', null)).toContain('start_of_refrain');
		expect(directiveNames('start_of_verse-alto', null)).toContain('start_of_verse-alto');
	});

	it('inserts matching environment tags and a Tab destination', () => {
		expect(insertDirective('start_of_verse')).toEqual({
			text: '{start_of_verse}\n\n{end_of_verse}',
			cursor: '{start_of_verse'.length,
			tabTarget: '{start_of_verse}'.length + 1
		});
		expect(insertDirective('title')).toEqual({
			text: '{title: }',
			cursor: '{title: '.length,
			tabTarget: null
		});
		expect(insertDirective('image')).toEqual({
			text: '{image: src=""}',
			cursor: '{image: src="'.length,
			tabTarget: null
		});
		expect(insertDirective('start_of_verse-alto').text).toBe(
			'{start_of_verse-alto}\n\n{end_of_verse}'
		);
	});
	it('moves Tab past a completed directive or chord', () => {
		const title = '{title: Alegría}';
		expect(tabDestination(title, title.indexOf('}'))).toBe(title.length);
		expect(tabDestination(title, title.length)).toBeNull();
		const chord = '[Am]Alegría';
		expect(tabDestination(chord, 2)).toBe(4);
		expect(tabDestination(chord, 5)).toBeNull();
		expect(tabDestination('{title: Alegría', 9)).toBeNull();
	});

	it('suggests the nearest unmatched closing tag and matches nested environments', () => {
		const content = '{start_of_verse}\n{x_start_of_bis}\n[x]Text\n{x_end_of_bis}\n{end_of_verse}';
		const tokens = scanDirectives(content);
		expect(suggestedClosingDirective(tokens, content.indexOf('[x]'))).toBe('x_end_of_bis');
		expect(directiveNames('', 'x_end_of_bis')[0]).toBe('x_end_of_bis');
		const pairs = matchingEnvironments(tokens);
		expect(pairs.get(tokens[0].from)).toBe(tokens[3].from);
		expect(pairs.get(tokens[1].from)).toBe(tokens[2].from);
	});

	it('omits parameters already present', () => {
		expect(availableParameters('x_start_of_bis', ' repeat="2" ')).toEqual(['label']);
		expect(availableParameters('image', ': src="score.png" align="left" ')).not.toContain('src');
		expect(availableParameters('define', ': C frets 0 3 2 0 1 0 ')).not.toContain('frets');
		expect(availableParameters('start_of_abc', ' label="Intro" ')).toContain('staffsep');
		expect(availableParameters('start_of_svg', ' align="left" ')).toContain('href');
		expect(availableParameters('start_of_textblock', ' flush="right" ')).toContain('padding');
	});

	it('wraps complete lines even when only part of a line is selected', () => {
		const content = 'Antes\nLa [C]primera línea\nOtra línea\nDespués';
		const from = content.indexOf('primera');
		const to = content.indexOf('Otra') + 4;
		const edit = wrapEnvironment(content, from, to, 'start_of_chorus');
		expect(content.slice(0, edit.from) + edit.text + content.slice(edit.to)).toBe(
			'Antes\n{start_of_chorus}\nLa [C]primera línea\nOtra línea\n{end_of_chorus}\nDespués'
		);
	});

	it('formats spacing around standard environments but not custom bis', () => {
		const source =
			'{title: Test}{start_of_verse}\n[C]Uno\n{x_start_of_bis}\n[D]Dos\n{x_end_of_bis}\n{end_of_verse}{chorus}';
		expect(formatChordPro(source)).toBe(
			'{title: Test}\n\n{start_of_verse}\n[C]Uno\n{x_start_of_bis}\n[D]Dos\n{x_end_of_bis}\n{end_of_verse}\n\n{chorus}'
		);
		expect(formatChordPro(formatChordPro(source))).toBe(formatChordPro(source));
	});

	it('leaves a blank line before each standard opening and after each standard closing', () => {
		const source =
			'{title: Song}\n{start_of_verse}\nFirst\n{end_of_verse}\n{start_of_chorus}\nSecond\n{end_of_chorus}\nLast';
		expect(formatChordPro(source)).toBe(
			'{title: Song}\n\n{start_of_verse}\nFirst\n{end_of_verse}\n\n{start_of_chorus}\nSecond\n{end_of_chorus}\n\nLast'
		);
	});

	it('does not treat embedded SVG markup as ChordPro directives', () => {
		const source = '{start_of_svg}\n<svg>{title: Not a song}</svg>\n{end_of_svg}';
		expect(scanDirectives(source).map((token) => token.name)).toEqual([
			'start_of_svg',
			'end_of_svg'
		]);
		expect(formatChordPro(source)).toBe(source);
	});
});
