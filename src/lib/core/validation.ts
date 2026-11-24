export class ValidationError extends Error {}

export function cleanText(value: unknown, label: string, maxLength: number): string {
	if (typeof value !== 'string') throw new ValidationError(`${label} is required`);
	const text = value.trim();
	if (!text || text.length > maxLength)
		throw new ValidationError(`${label} must contain 1–${maxLength} characters`);
	return text;
}

export function cleanEmail(value: unknown): string {
	const email = cleanText(value, 'Email', 254).toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError('Invalid email address');
	return email;
}

export function cleanPassword(value: unknown): string {
	if (typeof value !== 'string' || value.length < 12 || value.length > 256) {
		throw new ValidationError('Password must contain 12–256 characters');
	}
	return value;
}

export function cleanSongContent(value: unknown): string {
	if (typeof value !== 'string' || value.length > 200_000) {
		throw new ValidationError('ChordPro content must be at most 200,000 characters');
	}
	return value;
}

export function cleanIds(value: unknown, label: string): string[] {
	if (!Array.isArray(value) || !value.every((id) => typeof id === 'string')) {
		throw new ValidationError(`${label} must be a list of IDs`);
	}
	return [...new Set(value)];
}
