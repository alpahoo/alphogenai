import path from 'node:path';

import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { PHASE_PRODUCTION_BUILD } from 'next/dist/shared/lib/constants';
import { Client } from 'pg';

import * as schema from '@/models/Schema';

import { ENV_SERVER } from './Env';

let client;
let drizzle;

if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD && ENV_SERVER.DATABASE_URL) {
  client = new Client({
    connectionString: ENV_SERVER.DATABASE_URL,
  });
  await client.connect();

  drizzle = drizzlePg(client, { schema });
  await migratePg(drizzle, {
    migrationsFolder: path.join(process.cwd(), 'migrations'),
  });
} else {
  console.warn('No DATABASE_URL provided - using minimal fallback for development');

  drizzle = drizzlePg(new Client({ connectionString: 'postgresql://localhost:5432/fallback' }), { schema });
}

export const db = drizzle;
