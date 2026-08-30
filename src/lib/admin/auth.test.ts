import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminToken, tokensEqual } from "./auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("tokensEqual", () => {
  it("matches only the exact value", () => {
    expect(tokensEqual("abc123", "abc123")).toBe(true);
    expect(tokensEqual("abc124", "abc123")).toBe(false);
  });

  it("fails a wrong token of the same length and of a different length", () => {
    expect(tokensEqual("zzzzzz", "abc123")).toBe(false);
    expect(tokensEqual("abc", "abc123")).toBe(false);
    expect(tokensEqual("abc123456", "abc123")).toBe(false);
    expect(tokensEqual("", "abc123")).toBe(false);
  });
});

describe("isAdminToken", () => {
  it("is always false when ADMIN_TOKEN is not set", () => {
    vi.stubEnv("ADMIN_TOKEN", "");
    expect(isAdminToken("anything")).toBe(false);
    expect(isAdminToken("")).toBe(false);
  });

  it("accepts only the configured token", () => {
    vi.stubEnv("ADMIN_TOKEN", "secret-value");
    expect(isAdminToken("secret-value")).toBe(true);
    expect(isAdminToken("secret-valuE")).toBe(false);
    expect(isAdminToken(undefined)).toBe(false);
    expect(isAdminToken(null)).toBe(false);
  });
});
