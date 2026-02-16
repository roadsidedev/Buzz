/**
 * Vitest Global Setup
 * 
 * Initializes test environment, mocks, and shared fixtures
 */

import { beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import dotenv from "dotenv";

// Load test environment variables
dotenv.config({ path: ".env.test" });

// Set Node environment to test
process.env.NODE_ENV = "test";

// Global test configuration
beforeAll(() => {
  // Any global setup
  console.log("Test suite starting...");
});

afterAll(() => {
  // Any global teardown
  console.log("Test suite complete.");
});

beforeEach(() => {
  // Clear any mocks between tests
});

afterEach(() => {
  // Cleanup after each test
});
