/**
 * src/db/sync.js
 *
 * Creates all tables in CockroachDB using raw SQL — avoids Sequelize's
 * ALTER/DROP FK ordering issues with CockroachDB.
 *
 * Run once on setup:  node src/db/sync.js
 * Force full reset:   FORCE=true node src/db/sync.js  ⚠️  DESTROYS ALL DATA
 */

import '../config/index.js';
import sequelize from './index.js';

const force = process.env.FORCE === 'true';

console.log(`\n🔌 Connecting to CockroachDB...`);
console.log(`   URL: ${process.env.DATABASE_URL?.replace(/:\/\/.*@/, '://***@')}\n`);

try {
    await sequelize.authenticate();
    console.log('✅ Connection established\n');

    if (force) {
        console.log('⚠️  FORCE mode — dropping all tables...');
        // Drop in reverse FK order
        await sequelize.query('DROP TABLE IF EXISTS messages  CASCADE');
        await sequelize.query('DROP TABLE IF EXISTS documents CASCADE');
        await sequelize.query('DROP TABLE IF EXISTS sessions  CASCADE');
        await sequelize.query('DROP TABLE IF EXISTS users     CASCADE');
        console.log('   Tables dropped.\n');
    }

    console.log('🔄 Creating tables (if they do not exist)...');

    // 1. users (no FKs)
    await sequelize.query(`
        CREATE TABLE IF NOT EXISTS users (
            id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            uid         VARCHAR(255) NOT NULL UNIQUE,
            "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);
    console.log('   ✓ users');

    // 2. sessions (FK → users)
    await sequelize.query(`
        CREATE TABLE IF NOT EXISTS sessions (
            id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            title       VARCHAR(120) NOT NULL DEFAULT 'New conversation',
            "userId"    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);
    console.log('   ✓ sessions');

    // 3. messages (FK → sessions)
    await sequelize.query(`
        CREATE TABLE IF NOT EXISTS messages (
            id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            role        VARCHAR(10)  NOT NULL,
            parts       JSONB        NOT NULL,
            "sessionId" UUID         NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);
    console.log('   ✓ messages');

    // 4. documents (FK → users)
    await sequelize.query(`
        CREATE TABLE IF NOT EXISTS documents (
            id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            "fileName"  VARCHAR(255) NOT NULL,
            "mimeType"  VARCHAR(255) NOT NULL,
            "chunkIds"  VARCHAR(255)[] NOT NULL DEFAULT ARRAY[]::VARCHAR(255)[],
            "userId"    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    `);
    console.log('   ✓ documents');

    // Verify
    const [tables] = await sequelize.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
        { type: sequelize.constructor.QueryTypes.SELECT }
    );
    const tableList = Array.isArray(tables) ? tables : [tables];

    console.log('\n✅ All tables ready in CockroachDB:');
    tableList.forEach(r => {
        const name = typeof r === 'string' ? r : (r.table_name ?? Object.values(r)[0]);
        console.log(`   - ${name}`);
    });

    await sequelize.close();
    console.log('\n👋 Connection closed. All done!\n');
    process.exit(0);

} catch (err) {
    console.error('\n❌ DB sync failed:', err.message);
    if (err.original) console.error('   Original:', err.original.message);
    process.exit(1);
}
