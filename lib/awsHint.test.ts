import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { commandSetupHint } = await import("./server/aws");

describe("command setup hint", () => {
  it("names the one setting to fix for each AWS failure", () => {
    expect(commandSetupHint(new Error("The OIDC token was not found (VERCEL_OIDC_TOKEN)"))).toMatch(/OIDC Federation/);
    expect(commandSetupHint({ name: "AccessDenied", message: "Not authorized to perform sts:AssumeRoleWithWebIdentity" })).toMatch(/trust policy/);
    expect(commandSetupHint({ name: "ForbiddenException", message: "not authorized" })).toMatch(/iot:Publish/);
    expect(commandSetupHint({ name: "Error", message: "getaddrinfo ENOTFOUND bad-host" })).toMatch(/IOT_ENDPOINT/);
    expect(commandSetupHint({ name: "Throttling", message: "Rate exceeded" })).toBe("AWS refused the command: Throttling: Rate exceeded");
  });
});
