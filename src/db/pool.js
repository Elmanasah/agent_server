// src/db/pool.js
//
// Raw PostgreSQL connection pool.
// Used by UsageService to call stored procedures directly.
// The rest of the app uses Sequelize (src/db/index.js).
// Both connect to the same DATABASE_URL.

import pg from 'pg';
import config from '../config/index.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: { require: true, rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[pool] Unexpected database error:', err.message);
});

export default pool;