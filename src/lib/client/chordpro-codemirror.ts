import {
	autocompletion,
	closeCompletion,
	startCompletion,
	type Completion,
	type CompletionContext
} from '@codemirror/autocomplete';
import { EditorState, StateEffect, Prec } from '@codemirror/state';
import {
	Decoration,
	EditorView,
	ViewPlugin,
	keymap,
	type DecorationSet,
	type ViewUpdate
} from '@codemirror/view';
import { minimalSetup } from 'codemirror';
import {
	availableParameters,
	directiveDefinition,
	directiveNames,
	environmentIdentity,
	insertDirective,
	matchingEnvironments,
	scanDirectives,
	suggestedClosingDirective,
	wrapEnvironment,
	type DirectiveToken
} from './chordpro-language.js';

export interface ChordProEditorController {
	setValue(value: string): void;
	setLabel(label: string): void;
	destroy(): void;
}

const hoveredDirective = StateEffect.define<number | null>();

function findToken(
	tokens: readonly DirectiveToken[],
	position: number | null
): DirectiveToken | null {
	if (position === null) return null;
	return tokens.find((token) => position >= token.from && position <= token.to) ?? null;
}

function mark(from: number, to: number, className: string) {
	return Decoration.mark({ class: className }).range(from, to);
}

function editorDecorations(
	content: string,
	tokens: readonly DirectiveToken[],
	cursor: number,
	hovered: number | null
): DecorationSet {
	const pairs = matchingEnvironments(tokens);
	const selected = tokens.find((token) => token.from === hovered) ?? findToken(tokens, cursor);
	const matching = selected ? pairs.get(selected.from) : undefined;
	const marks = [];

	for (const token of tokens) {
		marks.push(mark(token.from, token.to, 'cm-chordpro-directive'));
		if (token.from === selected?.from || token.from === matching) {
			marks.push(mark(token.from, token.to, 'cm-chordpro-environment-match'));
		}
		const body = content.slice(token.bodyFrom, token.to - (token.closed ? 1 : 0));
		const colon = body.indexOf(':');
		if (colon >= 0 && token.bodyFrom + colon + 1 < token.to - (token.closed ? 1 : 0)) {
			marks.push(
				mark(token.bodyFrom + colon + 1, token.to - (token.closed ? 1 : 0), 'cm-chordpro-value')
			);
		}
		for (const attribute of body.matchAll(
			/(?:^|\s)([A-Za-z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s}]*))/g
		)) {
			const nameFrom = token.bodyFrom + attribute.index + attribute[0].indexOf(attribute[1]);
			marks.push(mark(nameFrom, nameFrom + attribute[1].length, 'cm-chordpro-parameter'));
			const equals = attribute[0].indexOf('=');
			const valueFrom = token.bodyFrom + attribute.index + equals + 1;
			const valueTo = token.bodyFrom + attribute.index + attribute[0].length;
			if (valueFrom < valueTo) marks.push(mark(valueFrom, valueTo, 'cm-chordpro-value'));
		}
		const definition = directiveDefinition(token.name);
		if (definition?.name === 'define' || definition?.name === 'chord') {
			for (const parameter of body.matchAll(
				/(?:^|\s)(base-fret|frets|fingers|keys|copy|copyall|diagram|display|format)(?=\s)/g
			)) {
				const from = token.bodyFrom + parameter.index + parameter[0].indexOf(parameter[1]);
				marks.push(mark(from, from + parameter[1].length, 'cm-chordpro-parameter'));
			}
		} else if (definition?.name === 'meta') {
			const name = /^:\s*([A-Za-z][\w-]*)/.exec(body);
			if (name) {
				const from = token.bodyFrom + name[0].indexOf(name[1]);
				marks.push(mark(from, from + name[1].length, 'cm-chordpro-parameter'));
			}
		}
	}

	for (const chord of content.matchAll(/\[[^\]\r\n]*\]/g)) {
		const from = chord.index;
		if (tokens.some((token) => from >= token.from && from < token.to)) continue;
		marks.push(mark(from, from + chord[0].length, 'cm-chordpro-chord'));
	}
	return Decoration.set(marks, true);
}

const highlighting = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;
		tokens: DirectiveToken[];
		hovered: number | null = null;
		constructor(view: EditorView) {
			this.tokens = scanDirectives(view.state.doc.toString());
			this.decorations = editorDecorations(
				view.state.doc.toString(),
				this.tokens,
				view.state.selection.main.head,
				null
			);
		}
		update(update: ViewUpdate) {
			if (update.docChanged) this.tokens = scanDirectives(update.state.doc.toString());
			for (const effect of update.transactions.flatMap((transaction) => transaction.effects)) {
				if (effect.is(hoveredDirective)) this.hovered = effect.value;
			}
			if (
				update.docChanged ||
				update.selectionSet ||
				update.viewportChanged ||
				update.transactions.some((transaction) =>
					transaction.effects.some((effect) => effect.is(hoveredDirective))
				)
			) {
				this.decorations = editorDecorations(
					update.state.doc.toString(),
					this.tokens,
					update.state.selection.main.head,
					this.hovered
				);
			}
		}
	},
	{
		decorations: (plugin) => plugin.decorations,
		eventHandlers: {
			mousemove(event, view) {
				const position = view.posAtCoords({ x: event.clientX, y: event.clientY });
				const hovered = findToken(this.tokens, position)?.from ?? null;
				if (hovered !== this.hovered) view.dispatch({ effects: hoveredDirective.of(hovered) });
			},
			mouseleave(_event, view) {
				if (this.hovered !== null) view.dispatch({ effects: hoveredDirective.of(null) });
			}
		}
	}
);

export function createChordProEditor(
	host: HTMLElement,
	initialValue: string,
	onChange: (value: string) => void,
	label: string
): ChordProEditorController {
	let wrapSelection: { from: number; to: number } | null = null;
	let forceDirectives = false;
	let pendingTab: { openingFrom: number; target: number } | null = null;

	function makeDirectiveCompletion(
		name: string,
		braceFrom: number | null,
		context: CompletionContext,
		selection: { from: number; to: number } | null = null
	): Completion {
		return {
			label: name,
			type: environmentIdentity(name) ? 'keyword' : 'function',
			apply(view) {
				if (selection) {
					const wrapped = wrapEnvironment(
						view.state.doc.toString(),
						selection.from,
						selection.to,
						name
					);
					view.dispatch({
						changes: { from: wrapped.from, to: wrapped.to, insert: wrapped.text },
						selection: { anchor: wrapped.from + wrapped.text.length }
					});
					return;
				}
				const line = view.state.doc.lineAt(context.pos);
				const remaining = view.state.sliceDoc(context.pos, line.to);
				const suffix = braceFrom === null ? 0 : (/^[\w-]*/.exec(remaining)?.[0].length ?? 0);
				const hasBrace = remaining[suffix] === '}';
				const from = braceFrom ?? context.pos;
				const to = context.pos + suffix + (hasBrace ? 1 : 0);
				const inserted = insertDirective(name);
				view.dispatch({
					changes: { from, to, insert: inserted.text },
					selection: { anchor: from + inserted.cursor }
				});
				pendingTab =
					inserted.tabTarget === null
						? null
						: {
								openingFrom: from,
								target: from + inserted.tabTarget
							};
			}
		};
	}

	function completionSource(context: CompletionContext) {
		const line = context.state.doc.lineAt(context.pos);
		const before = line.text.slice(0, context.pos - line.from);
		const braceIndex = before.lastIndexOf('{');
		const inside = braceIndex >= 0 && !before.slice(braceIndex).includes('}');
		const braceFrom = inside ? line.from + braceIndex : null;
		const fragment = inside ? before.slice(braceIndex + 1) : '';
		const selection = wrapSelection;
		wrapSelection = null;
		const forced = forceDirectives;
		forceDirectives = false;

		if (selection) {
			const options = directiveNames('', null, true).map((name) =>
				makeDirectiveCompletion(name, null, context, selection)
			);
			return { from: context.pos, options, filter: false };
		}

		const named = /^([A-Za-z_][\w-]*)(.*)$/.exec(fragment);
		if (inside && named) {
			const exact = directiveDefinition(named[1])?.name === named[1];
			const inBody = /^[:\s]/.test(named[2]) || (exact && context.explicit && named[2] === '');
			if (inBody) {
				const prefix = /([A-Za-z][\w-]*)?$/.exec(named[2])?.[1] ?? '';
				const body = named[2].slice(0, named[2].length - prefix.length);
				const options: Completion[] = availableParameters(named[1], body, prefix).map(
					(parameter) => ({
						label: parameter,
						type: 'property',
						apply(view) {
							const from = context.pos - prefix.length;
							const positional = named[1] === 'define' || named[1] === 'chord';
							const needsSeparator =
								named[2] === '' ? (named[1].startsWith('x_') ? ' ' : ': ') : '';
							const inserted = positional
								? `${needsSeparator}${parameter} `
								: `${needsSeparator}${parameter}=""`;
							view.dispatch({
								changes: { from, to: context.pos, insert: inserted },
								selection: { anchor: from + inserted.length - (positional ? 0 : 1) }
							});
						}
					})
				);
				return options.length
					? { from: context.pos - prefix.length, options, filter: false }
					: null;
			}
		}

		if (!inside && !context.explicit && !forced) return null;
		const query = inside ? fragment : '';
		if (inside && !/^[\w-]*$/.test(query)) return null;
		const closing = suggestedClosingDirective(
			scanDirectives(context.state.doc.toString()),
			context.pos
		);
		const options = directiveNames(query, closing).map((name) =>
			makeDirectiveCompletion(name, braceFrom, context)
		);
		return options.length
			? { from: inside ? braceFrom! + 1 : context.pos, options, filter: false }
			: null;
	}

	const view = new EditorView({
		state: EditorState.create({
			doc: initialValue,
			extensions: [
				minimalSetup,
				EditorView.contentAttributes.of({ 'aria-label': label }),
				Prec.highest(
					keymap.of([
						{
							key: 'Tab',
							run(view) {
								if (!pendingTab) return false;
								const openingLine = view.state.doc.lineAt(pendingTab.openingFrom);
								const closingBrace = view.state
									.sliceDoc(pendingTab.openingFrom, openingLine.to)
									.indexOf('}');
								const cursor = view.state.selection.main.head;
								if (
									closingBrace < 0 ||
									cursor < pendingTab.openingFrom ||
									cursor > pendingTab.openingFrom + closingBrace
								)
									return false;
								view.dispatch({ selection: { anchor: pendingTab.target } });
								pendingTab = null;
								return true;
							}
						}
					])
				),
				autocompletion({ override: [completionSource], activateOnTyping: true }),
				highlighting,
				EditorView.updateListener.of((update) => {
					if (update.docChanged) {
						if (pendingTab)
							pendingTab = {
								openingFrom: update.changes.mapPos(pendingTab.openingFrom, -1),
								target: update.changes.mapPos(pendingTab.target, 1)
							};
						onChange(update.state.doc.toString());
					}
				})
			]
		}),
		parent: host
	});

	function contextMenu(event: MouseEvent) {
		event.preventDefault();
		const selection = view.state.selection.main;
		if (!selection.empty) wrapSelection = { from: selection.from, to: selection.to };
		else {
			const position = view.posAtCoords({ x: event.clientX, y: event.clientY });
			if (position !== null) view.dispatch({ selection: { anchor: position } });
			forceDirectives = true;
		}
		view.focus();
		closeCompletion(view);
		startCompletion(view);
	}
	view.dom.addEventListener('contextmenu', contextMenu);

	return {
		setValue(value) {
			if (view.state.doc.toString() !== value) {
				view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
			}
		},
		setLabel(value) {
			view.contentDOM.setAttribute('aria-label', value);
		},
		destroy() {
			view.dom.removeEventListener('contextmenu', contextMenu);
			view.destroy();
		}
	};
}
