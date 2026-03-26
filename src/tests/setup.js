import { Sequelize } from "sequelize";
import { beforeAll, afterAll, jest } from "@jest/globals";
import config from "../config/index.js";
import { UsagePlan } from "../models/index.js";

// Increase timeout for slow database operations (e.g. CockroachDB sync)
jest.setTimeout(60000);

// 1. Determine the test database URL. 
const testDbUrl = config.testDatabaseUrl || config.databaseUrl || "postgres://localhost:5432/test_db";

const testSequelize = new Sequelize(testDbUrl, {
  dialect: "postgres",
  logging: false,
  pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
});

// 2. Global Mock: Redirect all imports of "src/db/index.js" to this test instance
// This ensures models and services use the test DB without touching the real config.
await jest.unstable_mockModule("../db/index.js", () => ({
  default: testSequelize,
}));

beforeAll(async () => {
  try {
    await testSequelize.authenticate();
    // Sync models (this will use the associations defined in models/index.js if imported later)
    await testSequelize.sync({ force: true });
    
    // Seed default plans for tests
    await UsagePlan.bulkCreate([
      { planName: 'free',       imageLimit: 10,   videoLimit: 5,    apiCallLimit: 1000,   documentLimit: 20,   resetPeriod: 'daily'   },
      { planName: 'pro',        imageLimit: 100,  videoLimit: 50,   apiCallLimit: 10000,  documentLimit: 200,  resetPeriod: 'daily'   },
      { planName: 'enterprise', imageLimit: 9999, videoLimit: 9999, apiCallLimit: 99999, documentLimit: 9999, resetPeriod: 'monthly' },
    ], { ignoreDuplicates: true });

    console.log(`[Test Setup] Database synced and plans seeded successfully.`);
  } catch (error) {
    console.error("[Test Setup] Failed to connect to test database:", error);
    process.exit(1);
  }
});

afterAll(async () => {
  await testSequelize.close();
  console.log(`[Test Setup] Connection closed.`);
});
