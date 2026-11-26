export interface DirectiveDefinition {
	name: string;
	aliases?: readonly string[];
	required?: 'value' | 'source' | 'meta' | 'name';
	parameters?: readonly string[];
	environment?: 'start' | 'end';
}

const metadata = [
	'title',
	'sorttitle',
	'subtitle',
	'artist',
	'sortartist',
	'composer',
	'lyricist',
	'arranger',
	'copyright',
	'album',
	'year',
	'key',
	'time',
	'tempo',
	'duration',
	'capo',
	'tag'
];
const metadataAliases: Record<string, string[]> = { title: ['t'], subtitle: ['st'] };
const environments = ['chorus', 'verse', 'bridge', 'tab', 'grid', 'abc', 'ly', 'svg', 'textblock'];
const environmentAliases: Record<string, [string, string]> = {
	chorus: ['soc', 'eoc'],
	verse: ['sov', 'eov'],
	bridge: ['sob', 'eob'],
	tab: ['sot', 'eot'],
	grid: ['sog', 'eog']
};
const fontTargets = ['chord', 'chorus', 'footer', 'grid', 'tab', 'label', 'toc', 'text', 'title'];
const imageParameters = [
	'src',
	'id',
	'width',
	'height',
	'scale',
	'align',
	'center',
	'border',
	'spread',
	'trbl',
	'href',
	'x',
	'y',
	'anchor'
];

export const directives: readonly DirectiveDefinition[] = [
	{ name: 'new_song', aliases: ['ns'], parameters: ['toc'] },
	...metadata.map((name): DirectiveDefinition => ({
		name,
		aliases: metadataAliases[name],
		required: 'value'
	})),
	{ name: 'meta', required: 'meta' },
	{ name: 'comment', aliases: ['c'], required: 'value' },
	{ name: 'highlight', required: 'value' },
	{ name: 'comment_italic', aliases: ['ci'], required: 'value' },
	{ name: 'comment_box', aliases: ['cb'], required: 'value' },
	{
		name: 'image',
		required: 'source',
		parameters: imageParameters
	},
	...environments.flatMap((name): DirectiveDefinition[] => [
		{
			name: `start_of_${name}`,
			aliases: environmentAliases[name]?.slice(0, 1),
			parameters:
				name === 'abc'
					? ['label', ...imageParameters, 'split', 'staffsep']
					: name === 'textblock'
						? [
								'label',
								...imageParameters,
								'padding',
								'flush',
								'vflush',
								'textstyle',
								'textsize',
								'textspacing',
								'textcolor',
								'background',
								'omit'
							]
						: name === 'svg'
							? ['label', ...imageParameters]
							: ['label'],
			environment: 'start'
		},
		{ name: `end_of_${name}`, aliases: environmentAliases[name]?.slice(1), environment: 'end' }
	]),
	{ name: 'chorus', parameters: ['label'] },
	{
		name: 'define',
		required: 'name',
		parameters: [
			'base-fret',
			'frets',
			'fingers',
			'keys',
			'copy',
			'copyall',
			'diagram',
			'display',
			'format',
			'root',
			'qual',
			'ext',
			'bass',
			'base_fret'
		]
	},
	{
		name: 'chord',
		required: 'name',
		parameters: [
			'base-fret',
			'frets',
			'fingers',
			'keys',
			'copy',
			'copyall',
			'diagram',
			'display',
			'format',
			'root',
			'qual',
			'ext',
			'bass',
			'base_fret'
		]
	},
	{ name: 'transpose' },
	...fontTargets.flatMap((target): DirectiveDefinition[] => [
		{
			name: `${target}font`,
			aliases: target === 'chord' ? ['cf'] : target === 'text' ? ['tf'] : undefined,
			required: 'value'
		},
		{
			name: `${target}size`,
			aliases: target === 'chord' ? ['cs'] : target === 'text' ? ['ts'] : undefined,
			required: 'value'
		},
		{ name: `${target}colour`, required: 'value' }
	]),
	{ name: 'new_page', aliases: ['np'] },
	{ name: 'new_physical_page', aliases: ['npp'] },
	{ name: 'column_break', aliases: ['colb'] },
	{ name: 'pagetype', required: 'value' },
	{ name: 'diagrams', required: 'value' },
	{ name: 'grid', aliases: ['g'] },
	{ name: 'no_grid', aliases: ['ng'] },
	{ name: 'titles', required: 'value' },
	{ name: 'columns', aliases: ['col'], required: 'value' },
	{ name: 'x_start_of_bis', parameters: ['repeat', 'label'], environment: 'start' },
	{ name: 'x_end_of_bis', environment: 'end' }
];

const byName = new Map<string, DirectiveDefinition>();
for (const directive of directives) {
	byName.set(directive.name, directive);
	for (const alias of directive.aliases ?? []) byName.set(alias, directive);
}

export function directiveDefinition(name: string): DirectiveDefinition | undefined {
	return byName.get(name.replace(/-[\w!]+$/, ''));
}

export interface DirectiveToken {
	name: string;
	from: number;
	to: number;
	nameFrom: number;
	nameTo: number;
	bodyFrom: number;
	closed: boolean;
}

const rawEnvironments = new Set(['tab', 'abc', 'ly', 'svg', 'textblock']);

export function scanDirectives(content: string): DirectiveToken[] {
	const tokens: DirectiveToken[] = [];
	let rawEnvironment: string | null = null;
	for (const lineMatch of content.matchAll(/[^\r\n]*(?:\r?\n|$)/g)) {
		const line = lineMatch[0].replace(/\r?\n$/, '');
		const lineStart = lineMatch.index;
		if (!line && lineMatch[0] === '') break;
		for (const match of line.matchAll(/\{([A-Za-z_][\w-]*)([^}\r\n]*)(\})?/g)) {
			const at = match.index;
			if (at > 0 && line[at - 1] === '\\') continue;
			const name = match[1];
			const environment = environmentIdentity(name);
			if (
				rawEnvironment &&
				!(
					environment?.kind === 'end' &&
					environment.name === rawEnvironment &&
					!line.slice(0, at).trim()
				)
			)
				continue;
			const token: DirectiveToken = {
				name,
				from: lineStart + at,
				to: lineStart + at + match[0].length,
				nameFrom: lineStart + at + 1,
				nameTo: lineStart + at + 1 + name.length,
				bodyFrom: lineStart + at + 1 + name.length,
				closed: match[3] === '}'
			};
			tokens.push(token);
			if (environment?.kind === 'start' && rawEnvironments.has(environment.name))
				rawEnvironment = environment.name;
			else if (environment?.kind === 'end' && environment.name === rawEnvironment)
				rawEnvironment = null;
		}
	}
	return tokens;
}

export function environmentIdentity(name: string): { kind: 'start' | 'end'; name: string } | null {
	const canonical = directiveDefinition(name)?.name ?? name;
	if (canonical === 'x_start_of_bis') return { kind: 'start', name: 'x_bis' };
	if (canonical === 'x_end_of_bis') return { kind: 'end', name: 'x_bis' };
	const match = /^(start|end)_of_([\w]+)(?:-[\w!]+)?$/.exec(canonical);
	return match ? { kind: match[1] as 'start' | 'end', name: match[2] } : null;
}

export function matchingEnvironments(tokens: readonly DirectiveToken[]): Map<number, number> {
	const pairs = new Map<number, number>();
	const stack: { token: DirectiveToken; name: string }[] = [];
	for (const token of tokens) {
		if (!token.closed) continue;
		const environment = environmentIdentity(token.name);
		if (!environment) continue;
		if (environment.kind === 'start') stack.push({ token, name: environment.name });
		else {
			const index = stack.findLastIndex((entry) => entry.name === environment.name);
			if (index < 0) continue;
			const opening = stack.splice(index, 1)[0].token;
			pairs.set(opening.from, token.from);
			pairs.set(token.from, opening.from);
		}
	}
	return pairs;
}

export function suggestedClosingDirective(
	tokens: readonly DirectiveToken[],
	before: number
): string | null {
	const stack: string[] = [];
	for (const token of tokens) {
		if (token.from >= before) break;
		const identity = environmentIdentity(token.name);
		if (!identity || !token.closed) continue;
		if (identity.kind === 'start') stack.push(identity.name);
		else {
			const index = stack.lastIndexOf(identity.name);
			if (index >= 0) stack.splice(index, 1);
		}
	}
	const name = stack.at(-1);
	return name ? (name === 'x_bis' ? 'x_end_of_bis' : `end_of_${name}`) : null;
}

export function directiveNames(
	query: string,
	closing: string | null,
	onlyEnvironments = false
): string[] {
	const lowered = query.toLowerCase();
	const names = directives
		.filter(
			(directive) =>
				(!onlyEnvironments || directive.environment === 'start') &&
				(directive.name.includes(lowered) ||
					directive.aliases?.some((alias) => alias.includes(lowered)))
		)
		.map((directive) => directive.name);
	if (
		lowered &&
		!names.includes(lowered) &&
		(directiveDefinition(lowered) || /^(?:start|end)_of_[a-z0-9_]+$/.test(lowered)) &&
		(!onlyEnvironments || environmentIdentity(lowered)?.kind === 'start')
	)
		names.push(lowered);
	if (closing && !onlyEnvironments && closing.includes(lowered)) {
		return [closing, ...names.filter((name) => name !== closing)];
	}
	return names;
}

export function availableParameters(name: string, body: string, query = ''): string[] {
	const parameters =
		directiveDefinition(name)?.parameters ??
		(environmentIdentity(name)?.kind === 'start' ? ['label'] : []);
	const positional = name === 'define' || name === 'chord';
	const used = new Set(
		[
			...body.matchAll(
				positional ? /(?:^|\s)([A-Za-z][\w-]*)(?=\s)/g : /(?:^|\s)([A-Za-z][\w-]*)\s*=/g
			)
		]
			.map((match) => match[1])
			.filter((parameter) => parameters.includes(parameter))
	);
	return parameters.filter((parameter) => !used.has(parameter) && parameter.includes(query));
}

export interface InsertedDirective {
	text: string;
	cursor: number;
	tabTarget: number | null;
}

export function insertDirective(name: string): InsertedDirective {
	const definition = directiveDefinition(name);
	const canonical = name.includes('-') ? name : (definition?.name ?? name);
	const environment = environmentIdentity(canonical);
	if (environment?.kind === 'start') {
		const closing = environment.name === 'x_bis' ? 'x_end_of_bis' : `end_of_${environment.name}`;
		const opening = `{${canonical}}`;
		return {
			text: `${opening}\n\n{${closing}}`,
			cursor: opening.length - 1,
			tabTarget: opening.length + 1
		};
	}
	if (definition?.required === 'source') {
		const text = `{${canonical}: src=""}`;
		return { text, cursor: text.length - 2, tabTarget: null };
	}
	if (definition?.required) {
		const text = `{${canonical}: }`;
		return { text, cursor: text.length - 1, tabTarget: null };
	}
	const text = `{${canonical}}`;
	return { text, cursor: text.length, tabTarget: null };
}

export function tabDestination(content: string, cursor: number): number | null {
	const tokens = scanDirectives(content);
	const directive = tokens.find((token) => cursor >= token.from && cursor < token.to);
	if (directive) return directive.closed ? directive.to : null;
	for (const chord of content.matchAll(/\[[^\]\r\n]*\]/g)) {
		const from = chord.index;
		const to = from + chord[0].length;
		if (cursor >= from && cursor < to) return to;
	}
	return null;
}

export function wrapEnvironment(
	content: string,
	from: number,
	to: number,
	name: string
): { from: number; to: number; text: string } {
	const identity = environmentIdentity(name);
	if (!identity || identity.kind !== 'start')
		throw new Error('Expected an opening environment directive');
	const start = content.lastIndexOf('\n', Math.max(0, from - 1)) + 1;
	const selectedEnd = to > from && content[to - 1] === '\n' ? to - 1 : to;
	const nextBreak = content.indexOf('\n', selectedEnd);
	const end = nextBreak < 0 ? content.length : nextBreak;
	const closing = identity.name === 'x_bis' ? 'x_end_of_bis' : `end_of_${identity.name}`;
	return { from: start, to: end, text: `{${name}}\n${content.slice(start, end)}\n{${closing}}` };
}

export function formatChordPro(content: string): string {
	const source = content.replace(/\r\n/g, '\n');
	const tokens = scanDirectives(source).filter((token) => token.closed);
	let isolated = '';
	let offset = 0;
	const tokenPositions = new Map<number, DirectiveToken>();
	for (const token of tokens) {
		isolated += source.slice(offset, token.from);
		if (isolated.slice(isolated.lastIndexOf('\n') + 1).trim()) {
			isolated = isolated.replace(/[ \t]+$/, '');
			isolated += '\n';
		}
		tokenPositions.set(isolated.length, token);
		isolated += source.slice(token.from, token.to);
		if (token.to < source.length && source[token.to] !== '\n') isolated += '\n';
		offset = token.to;
	}
	isolated += source.slice(offset);
	const lines = isolated.split('\n');
	const hasFollowingText = new Array<boolean>(lines.length);
	let followingText = false;
	for (let index = lines.length - 1; index >= 0; index -= 1) {
		hasFollowingText[index] = followingText;
		if (lines[index].trim()) followingText = true;
	}
	const result: string[] = [];
	let lineStart = 0;
	let hasPreviousText = false;
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		const directive = tokenPositions.get(lineStart + line.indexOf('{'));
		const identity = directive ? environmentIdentity(directive.name) : null;
		const custom = directive?.name.startsWith('x_') ?? false;
		if (identity?.kind === 'start' && !custom && hasPreviousText && result.at(-1)?.trim())
			result.push('');
		result.push(line);
		if (line.trim()) hasPreviousText = true;
		if (identity?.kind === 'end' && !custom && hasFollowingText[index] && lines[index + 1]?.trim())
			result.push('');
		lineStart += line.length + 1;
	}
	while (result[0] === '') result.shift();
	while (result.at(-1) === '') result.pop();
	return result.join('\n');
}
