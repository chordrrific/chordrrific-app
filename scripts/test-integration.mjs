import { closeSync, mkdtempSync, openSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const directory = mkdtempSync(join(process.cwd(), 'data', 'integration-'));
closeSync(openSync(join(directory, 'test.db'), 'w'));
const env = {
	...process.env,
	DATABASE_URL: `file:${join(directory, 'test.db')}`,
	ADMIN_EMAIL: 'seed@example.com',
	ADMIN_PASSWORD: 'integration-password-123'
};
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

try {
	for (const args of [
		['run', 'db:deploy'],
		['run', 'db:seed'],
		['run', 'db:seed'],
		['exec', '--', 'vitest', 'run', 'tests/integration']
	]) {
		const result = spawnSync(npm, args, { env, stdio: 'inherit' });
		if (result.status !== 0) process.exit(result.status ?? 1);
	}
} finally {
	rmSync(directory, { recursive: true, force: true });
}
