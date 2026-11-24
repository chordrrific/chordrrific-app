import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { relative } from 'node:path';
import { databaseUrl } from './database-url';

export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: { path: 'prisma/migrations' },
	datasource: { url: `file:./${relative(process.cwd(), databaseUrl().slice(5))}` }
});
