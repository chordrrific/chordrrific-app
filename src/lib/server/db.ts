import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/prisma/client';
import { databaseUrl } from '../../../database-url';

const globalDb = globalThis as typeof globalThis & { chordrrificDb?: PrismaClient };

export const db =
	globalDb.chordrrificDb ??
	new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl() }) });
if (process.env.NODE_ENV !== 'production') globalDb.chordrrificDb = db;
