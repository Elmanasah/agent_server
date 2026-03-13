/**
 * src/db/index.js
 *
 * Sequelize instance — singleton connected to CockroachDB (PostgreSQL-compatible).
 * Import this wherever you need DB access.
 */

import { Sequelize } from 'sequelize';
import config from '../config/index.js';

const sequelize = new Sequelize(config.databaseUrl, {
    dialect: 'postgres',
    dialectOptions: {
        ssl: { require: true, rejectUnauthorized: false },
    },
    logging: config.isDev ? (msg) => console.log('[sql]', msg) : false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
});

export default sequelize;
