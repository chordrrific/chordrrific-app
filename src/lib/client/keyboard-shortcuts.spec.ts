import { describe, expect, it } from 'vitest';
import { shortcutCommand } from './keyboard-shortcuts.js';

const key = (
	value: string,
	options: Partial<Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'isComposing' | 'repeat'>> = {}
) => ({
	key: value,
	ctrlKey: false,
	metaKey: false,
	isComposing: false,
	repeat: false,
	...options
});

describe('keyboard shortcuts', () => {
	it('saves with Ctrl or Command plus Enter and cancels with Escape', () => {
		expect(shortcutCommand(key('Enter', { ctrlKey: true }))).toBe('save');
		expect(shortcutCommand(key('Enter', { metaKey: true }))).toBe('save');
		expect(shortcutCommand(key('Escape'))).toBe('cancel');
		expect(shortcutCommand(key('Enter'))).toBeNull();
	});
	it('does not act on composing or repeated keys', () => {
		expect(shortcutCommand(key('Enter', { ctrlKey: true, isComposing: true }))).toBeNull();
		expect(shortcutCommand(key('Escape', { repeat: true }))).toBeNull();
	});
});
