export interface KeyboardShortcutOptions {
	onSave?: () => void;
	onCancel?: () => void;
}

export function shortcutCommand(
	event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'isComposing' | 'repeat'>
): 'save' | 'cancel' | null {
	if (event.isComposing || event.repeat) return null;
	if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) return 'save';
	if (event.key === 'Escape') return 'cancel';
	return null;
}

export function keyboardShortcuts(node: HTMLElement, options: KeyboardShortcutOptions = {}) {
	let callbacks = options;
	function keydown(event: KeyboardEvent) {
		const command = shortcutCommand(event);
		if (command === 'save') {
			const save = callbacks.onSave ?? (node instanceof HTMLFormElement ? submitForm : undefined);
			if (!save) return;
			event.preventDefault();
			event.stopPropagation();
			save();
		} else if (command === 'cancel' && callbacks.onCancel) {
			event.preventDefault();
			event.stopPropagation();
			callbacks.onCancel();
		}
	}
	function submitForm() {
		if (!(node instanceof HTMLFormElement)) return;
		const submitter = node.querySelector<HTMLButtonElement>(
			'button[type="submit"], button:not([type])'
		);
		if (submitter?.disabled) return;
		if (submitter) node.requestSubmit(submitter);
		else node.requestSubmit();
	}
	node.addEventListener('keydown', keydown, true);
	return {
		update(next: KeyboardShortcutOptions) {
			callbacks = next;
		},
		destroy() {
			node.removeEventListener('keydown', keydown, true);
		}
	};
}
