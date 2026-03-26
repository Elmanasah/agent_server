/**
 * src/db/index.js
 *
 * Sequelize instance — singleton connected to CockroachDB (PostgreSQL-compatible).
 * Import this wherever you need DB access.
 */

import { Sequelize } from 'sequelize';
import config from '../config/index.js';

// Create Sequelize instance
// Fallback to a dummy string if URL is missing to avoid crashing on import in CI/CD environments.
// Real connections will still fail at authenticate() if the URL is truly required.
const dbUrl = config.databaseUrl || 'postgres://localhost:5432/horus_db';
const useSsl = dbUrl.includes('sslmode=require') || dbUrl.includes('sslmode=verify-full') || dbUrl.includes('cockroachlabs.cloud');

const sequelize = new Sequelize(dbUrl, {
    dialect: 'postgres',
    dialectOptions: useSsl ? {
        ssl: { require: true, rejectUnauthorized: false },
    } : {},
    logging: config.isDev ? (msg) => console.log('[sql]', msg) : false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
});

export default sequelize;
