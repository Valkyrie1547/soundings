import { describe, expect, it } from "vitest";
import { isUuid } from "./validate";

describe("isUuid", () => {
  it("accepts a v4 uuid in either case", () => {
    expect(isUuid("3b241101-e2bb-4255-8caf-4136c566a962")).toBe(true);
    expect(isUuid("3B241101-E2BB-4255-8CAF-4136C566A962")).toBe(true);
  });

  it("rejects values that are not a uuid string", () => {
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(42)).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("3b241101-e2bb-4255-8caf-4136c566a96")).toBe(false);
    expect(isUuid("3b241101e2bb42558caf4136c566a962")).toBe(false);
  });
});
