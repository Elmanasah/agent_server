import { Sequelize } from "sequelize";
import { beforeAll, afterAll, jest } from "@jest/globals";
import config from "../config/index.js";

// 1. Create a STANDALONE test database instance
const testSequelize = new Sequelize(config.testDatabaseUrl, {
  dialect: "postgres",
  dialectOptions: config.testDatabaseUrl.includes('localhost') || config.testDatabaseUrl.includes('127.0.0.1') ? {} : {
    ssl: { require: true, rejectUnauthorized: false },
  },
  logging: false, // Keep logs clean during tests
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

// 2. Global Mock: Redirect all imports of "src/db/index.js" to this test instance
// This ensures models and services use the test DB without touching the real config.
await jest.unstable_mockModule("../db/index.js", () => ({
  default: testSequelize,
}));

beforeAll(async () => {
  console.log(`[Test Setup] Connecting to isolated test database...`);

  if (!config.testDatabaseUrl) {
    throw new Error("CRITICAL: TEST_DATABASE_URL is not defined in environment!");
  }

  try {
    await testSequelize.authenticate();
    // Sync models (this will use the associations defined in models/index.js if imported later)
    await testSequelize.sync({ force: true });
    console.log(`[Test Setup] Database synced successfully.`);
  } catch (error) {
    console.error("[Test Setup] Failed to connect to test database:", error);
    process.exit(1);
  }
});

afterAll(async () => {
  await testSequelize.close();
  console.log(`[Test Setup] Connection closed.`);
});
