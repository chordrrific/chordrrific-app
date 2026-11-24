import 'dotenv/config';
import { resolve } from 'node:path';

export function databaseUrl(): string {
	const value = process.env.DATABASE_URL ?? 'file:./data/chordrrific.db';
	if (!value.startsWith('file:')) throw new Error('DATABASE_URL must be a SQLite file URL');
	const path = value.slice(5);
	if (!path) throw new Error('DATABASE_URL must include a file path');
	return `file:${resolve(path)}`;
}
