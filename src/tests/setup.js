import { Sequelize } from "sequelize";
import { beforeAll, afterAll, jest } from "@jest/globals";
import config from "../config/index.js";

// Increase timeout for slow database operations (e.g. CockroachDB sync)
jest.setTimeout(60000);

// We'll import models dynamically later to avoid ESM hoisting issues
let UsagePlan;

// 1. Determine the test database URL. 
const testDbUrl = config.testDatabaseUrl || config.databaseUrl || "postgres://localhost:5432/test_db";

// 2. Determine if SSL is needed. 
const isLocal = testDbUrl.includes('localhost') || testDbUrl.includes('127.0.0.1') || testDbUrl.includes('postgres') || testDbUrl.includes('db');
const hasSslMode = testDbUrl.includes('sslmode=require') || testDbUrl.includes('sslmode=verify-full');
const isCloud  = testDbUrl.includes('cockroachlabs.cloud') || testDbUrl.includes('amazonaws.com') || testDbUrl.includes('google.com');

const useSsl = hasSslMode || (isCloud && !isLocal);

const testSequelize = new Sequelize(testDbUrl, {
  dialect: "postgres",
  dialectOptions: useSsl ? {
    ssl: { require: true, rejectUnauthorized: false },
  } : {},
  logging: false,
  pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
});

// 2. Global Mock: Redirect all imports of "src/db/index.js" to this test instance
await jest.unstable_mockModule("../db/index.js", () => ({
  default: testSequelize,
}));

beforeAll(async () => {
  try {
    // Dynamically import models AFTER the mock is active
    const models = await import("../models/index.js");
    UsagePlan = models.UsagePlan;

    await testSequelize.authenticate();
    // Sync models (this will now sync all models imported above)
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
