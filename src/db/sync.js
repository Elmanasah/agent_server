/**
 * src/db/sync.js
 *
 * Syncs all Sequelize models to CockroachDB.
 *
 * Run once on setup:  node src/db/sync.js
 * Force full reset:   FORCE=true node src/db/sync.js  ⚠️  DESTROYS ALL DATA
 */

import '../config/index.js';
import { sequelize, User, Session, Message, Document, OTP, Memory, Task, UsagePlan, UserUsage, Log } from '../models/index.js';

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
    await User.sync({ force, alter: true });
    console.log('   ✓ users');

    await Session.sync({ force, alter: true });
    console.log('   ✓ sessions');

    await Message.sync({ force, alter: true });
    console.log('   ✓ messages');

    await Document.sync({ force, alter: true });
    console.log('   ✓ documents');

    await OTP.sync({ force, alter: true });
    console.log('   ✓ otps');

    await Memory.sync({ force, alter: true });
    console.log('   ✓ memories');

    await Task.sync({ force, alter: true });
    console.log('   ✓ tasks');

    await UsagePlan.sync({ force, alter: true });
    console.log('   ✓ usage_plans');

    await UserUsage.sync({ force, alter: true });
    console.log('   ✓ user_usage');

    await Log.sync({ force, alter: true });
    console.log('   ✓ activity_logs');

    // Seed default plans after sync
    const plans = [
        { planName: 'free',       imageLimit: 10,   videoLimit: 5,    apiCallLimit: 1000,   documentLimit: 20,   resetPeriod: 'daily'   },
        { planName: 'pro',        imageLimit: 100,  videoLimit: 50,   apiCallLimit: 10000,  documentLimit: 200,  resetPeriod: 'daily'   },
        { planName: 'enterprise', imageLimit: 9999, videoLimit: 9999, apiCallLimit: 99999, documentLimit: 9999, resetPeriod: 'monthly' },
    ];

    for (const plan of plans) {
        await UsagePlan.upsert(plan);
    }
    console.log('   ✓ usage plans seeded');

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
