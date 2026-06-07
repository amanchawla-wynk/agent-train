import { config as loadEnv } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDbConnectionDetail, closePool } from '../db/pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../../../.env') });

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[db] DATABASE_URL is not set. Copy .env.example → .env and configure Postgres.');
    process.exit(1);
  }

  const { ok, error } = await checkDbConnectionDetail();
  await closePool();

  if (ok) {
    console.log('[db] Connected successfully');
    process.exit(0);
  }

  console.error('[db] Connection failed:', error ?? 'unknown error');
  if (error?.includes('role') && error.includes('does not exist')) {
    console.error('[db] Hint: Homebrew Postgres uses your macOS username, not "agenttrain".');
    console.error('[db] Set DATABASE_URL=postgresql://YOUR_MAC_USERNAME@localhost:5432/agenttrain');
  }
  console.error('[db] Ensure Homebrew Postgres is running:');
  console.error('  brew install postgresql@17');
  console.error('  brew services start postgresql@17');
  console.error('  createdb agenttrain   # if the database does not exist yet');
  console.error('  pnpm db:migrate');
  process.exit(1);
}

main().catch((err) => {
  console.error('[db] Check failed:', err);
  process.exit(1);
});
