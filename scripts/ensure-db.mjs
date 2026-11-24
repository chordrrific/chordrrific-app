import 'dotenv/config';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const url = process.env.DATABASE_URL ?? 'file:./data/chordrrific.db';
if (!url.startsWith('file:') || !url.slice(5))
	throw new Error('DATABASE_URL must be a SQLite file URL');
const path = resolve(url.slice(5));
mkdirSync(dirname(path), { recursive: true });
closeSync(openSync(path, 'a'));
