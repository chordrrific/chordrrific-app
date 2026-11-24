import { describe, expect, it } from 'vitest';
import { cleanEmail, cleanPassword, cleanText } from './validation';

describe('input validation', () => {
	it('normalizes email without changing password text', () => {
		expect(cleanEmail('  Person@Example.COM ')).toBe('person@example.com');
		expect(cleanPassword('  long password  ')).toBe('  long password  ');
	});
	it('rejects empty titles and short passwords', () => {
		expect(() => cleanText('  ', 'Title', 160)).toThrow();
		expect(() => cleanPassword('short')).toThrow();
	});
});
