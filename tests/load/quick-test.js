#!/usr/bin/env node

/**
 * Quick Start - Stress Test Script
 *
 * This script runs a lightweight stress test to give you quick performance numbers
 * for your resume. It runs a shorter test (2 min total) with lower VU counts.
 */

const { execSync } = require("child_process");

console.log(`
This will run a 2-minute stress test with:
  • 10 VUs for 30s (warm-up)
  • 50 VUs for 1m (sustained load)
  • 10 VUs for 30s (cool-down)

Make sure you have:
  ✓ Docker Compose running (docker compose up -d)
  ✓ API server running (pnpm start)
  ✓ Workers running
    - npx ts-node workers/validation.ts
    - npx ts-node workers/processing.ts
`);

// Wait 3 seconds
setTimeout(() => {
  try {
    console.log("Running k6 stress test...\n");

    execSync(
      `k6 run -e QUICK_TEST=1 --stage 30s:10 --stage 1m:50 --stage 30s:10 tests/load/upload-stress.test.js`,
      {
        stdio: "inherit",
        env: {
          ...process.env,
          API_URL: process.env.API_URL || "http://localhost:3000/api/v1",
        },
      },
    );

    console.log(`
Check the results above for your resume metrics.
For a full stress test, run: pnpm test:stress

To test worker throughput: pnpm test:worker
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
  } catch (error) {
    console.error("\nTest failed. Make sure:");
    console.error("  1. Docker services are running");
    console.error("  2. API server is running on port 3000");
    console.error("  3. Workers are running\n");
    process.exit(1);
  }
}, 3000);
