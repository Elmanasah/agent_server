// src/utils/runMigrations.js
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { sequelize } from '../models/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
const migrationsDir = join(__dirname, '../modules/migrations');
  const files = [
    '001_create_usage_tracking.sql',
    // add future migration files here in order
    // '002_add_something.sql',
  ];

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf8');

    try {
      await sequelize.query(sql);
      console.log(`✅ Migration  ${file} applied`);
    } catch (err) {
      // If tables already exist CockroachDB will throw — we ignore that
      if (err.message.includes('already exists')) {
        console.log(`⏭️  Migration  ${file} already applied — skipping`);
      } else {
        throw err; // real error — stop the server
      }
    }
  }
}