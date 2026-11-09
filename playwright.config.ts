import { defineConfig, devices } from "@playwright/test";
import bcrypt from "bcryptjs";
import { TEST_PIN } from "./e2e/testValues";

// Runs against a production build with demo auth and the in-memory store. No real keys are used.
const PORT = 3100;
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
  webServer: {
    // Build with Clerk and Convex blanked: NEXT_PUBLIC_* values are baked in at build time.
    command: `npx next build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/me`,
    reuseExistingServer: false,
    timeout: 900_000,
    env: {
      DEMO_AUTH: "true",
      SUPERVISOR_PIN_HASH: Buffer.from(bcrypt.hashSync(TEST_PIN, 10)).toString("base64"),
      CLERK_SECRET_KEY: "",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
      AWS_ROLE_ARN: "",
      CONVEX_URL: "",
      NEXT_PUBLIC_CONVEX_URL: "",
      CONVEX_SERVER_KEY: "",
      PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY ?? "",
    },
  },
});
