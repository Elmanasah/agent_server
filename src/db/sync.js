/**
 * src/db/sync.js
 *
 * Syncs all Sequelize models to CockroachDB.
 *
 * Run once on setup:  node src/db/sync.js
 * Force full reset:   FORCE=true node src/db/sync.js  ⚠️  DESTROYS ALL DATA
 */

import '../config/index.js';
import { sequelize, User, Session, Message, Document, OTP, Memory, Task } from '../models/index.js';

const force = process.env.FORCE === 'true';

console.log(`\n🔌 Connecting to CockroachDB...`);
console.log(`   URL: ${process.env.DATABASE_URL?.replace(/:\/\/.*@/, '://***@')}\n`);

try {
    await sequelize.authenticate();
    console.log('✅ Connection established\n');

    if (force) {
        console.log('⚠️  FORCE mode — dropping and recreating all tables...\n');
    }

    console.log('🔄 Syncing models...');

    // Sync each model in FK-dependency order
    await User.sync({ force });
    console.log('   ✓ users');

    await Session.sync({ force });
    console.log('   ✓ sessions');

    await Message.sync({ force });
    console.log('   ✓ messages');

    await Document.sync({ force });
    console.log('   ✓ documents');

    await OTP.sync({ force });
    console.log('   ✓ otps');

    await Memory.sync({ force });
    console.log('   ✓ memories');

    await Task.sync({ force });
    console.log('   ✓ tasks');

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
