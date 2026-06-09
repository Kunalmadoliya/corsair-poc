import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createCorsair } from 'corsair';
import { github } from '@corsair-dev/github';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export const corsair = createCorsair({
    plugins: [github()],
    database: pool,
    kek: process.env.CORSAIR_KEK!,
});