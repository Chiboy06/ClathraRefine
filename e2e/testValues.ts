// Test-only supervisor PIN for the local Playwright run. The server only ever sees its bcrypt hash.
export const TEST_PIN = process.env.TEST_SUPERVISOR_PIN ?? "246813";
