import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/lib/server/generated/prisma/client';
import { databaseUrl } from '../database-url';
import { cleanEmail, cleanPassword } from '../src/lib/core/validation';

const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl() }) });

try {
	if (await db.user.findFirst({ where: { isAdmin: true } })) {
		console.log('Administrator already exists; seed skipped.');
	} else {
		const email = cleanEmail(process.env.ADMIN_EMAIL);
		const password = cleanPassword(process.env.ADMIN_PASSWORD);
		await db.user.create({
			data: { email, passwordHash: await argon2.hash(password), isAdmin: true }
		});
		console.log(`Administrator created: ${email}`);
	}
} finally {
	await db.$disconnect();
}
