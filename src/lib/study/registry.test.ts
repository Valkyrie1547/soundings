import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeStudy } from "@/test/fixtures";

/**
 * A thenable query builder. Every method returns the same object. An
 * `await` resolves with the next queued result.
 */
const results: unknown[][] = [];
const chain: Record<string, unknown> = {};
const CHAIN_METHODS = ["select", "from", "where", "orderBy", "limit", "insert", "values"];
for (const m of CHAIN_METHODS) chain[m] = vi.fn(() => chain);
chain.then = (resolve: (v: unknown) => void) => resolve(results.shift() ?? []);

vi.mock("@/db", () => ({ db: () => chain }));

import { clearStudyCache, listStudies, loadLiveStudy, loadStudy, publishStudy, sameContent, seedStudy } from "./registry";

const tiny = makeStudy();
const row = (version: number, config = { ...tiny, version }, publishedAt = new Date("2026-08-30T00:00:00Z")) => ({
  id: tiny.id,
  version,
  config,
  publishedAt,
});

beforeEach(() => {
  results.length = 0;
  clearStudyCache();
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadStudy", () => {
  it("returns null for a missing version", async () => {
    results.push([]);
    expect(await loadStudy("tiny", 9)).toBeNull();
  });

  it("caches a version after the first read", async () => {
    results.push([row(1)]);
    expect((await loadStudy("tiny", 1))?.id).toBe("tiny");
    expect((await loadStudy("tiny", 1))?.version).toBe(1);
    expect(chain.select).toHaveBeenCalledTimes(1);
  });

  it("throws when the stored row is not a valid study", async () => {
    results.push([{ config: { id: "tiny" } }]);
    await expect(loadStudy("tiny", 1)).rejects.toThrow(/stored study tiny@1 is invalid/);
  });
});

describe("loadLiveStudy", () => {
  it("returns the row the query orders first and caches it for a short time", async () => {
    results.push([row(3)]);
    expect((await loadLiveStudy("tiny"))?.version).toBe(3);
    expect((await loadLiveStudy("tiny"))?.version).toBe(3);
    expect(chain.select).toHaveBeenCalledTimes(1);
    // The live read also fills the version cache.
    expect((await loadStudy("tiny", 3))?.version).toBe(3);
    expect(chain.select).toHaveBeenCalledTimes(1);
  });

  it("returns null for an unknown id", async () => {
    results.push([]);
    expect(await loadLiveStudy("ghost")).toBeNull();
  });
});

describe("publishStudy", () => {
  it("refuses a body that equals the live version", async () => {
    results.push([row(2)]);
    expect(await publishStudy({ ...tiny, version: 99 })).toEqual({ ok: false, reason: "unchanged" });
    expect(chain.insert).not.toHaveBeenCalled();
  });

  it("stores the next version number, not the one in the body", async () => {
    const changed = { ...tiny, title: "Renamed", version: 1 };
    results.push([row(2)], [{ max: 2 }]);
    expect(await publishStudy(changed)).toEqual({ ok: true, version: 3 });
    expect(chain.values).toHaveBeenCalledWith({ id: "tiny", version: 3, config: { ...changed, version: 3 } });
    // The new version is in the cache, and the live pointer is cleared.
    expect((await loadStudy("tiny", 3))?.title).toBe("Renamed");
    results.push([row(3, { ...changed, version: 3 })]);
    expect((await loadLiveStudy("tiny"))?.version).toBe(3);
  });
});

describe("seedStudy", () => {
  it("inserts a new version, skips the same content, and reports a conflict", async () => {
    results.push([]);
    expect(await seedStudy(tiny)).toBe("inserted");
    clearStudyCache();
    results.push([row(1)]);
    expect(await seedStudy(tiny)).toBe("same");
    clearStudyCache();
    results.push([row(1)]);
    expect(await seedStudy({ ...tiny, title: "Other" })).toBe("conflict");
  });
});

describe("listStudies and sameContent", () => {
  it("lists one row per id, the newest first", async () => {
    results.push([row(2), row(1), { id: "other", version: 1, config: { ...tiny, id: "other", title: "Other" }, publishedAt: new Date(0) }]);
    const list = await listStudies();
    expect(list.map((s) => `${s.id}@${s.version}`)).toEqual(["tiny@2", "other@1"]);
    expect(list[1].title).toBe("Other");
  });

  it("compares content and ignores the version field", () => {
    expect(sameContent(tiny, { ...tiny, version: 7 })).toBe(true);
    expect(sameContent(tiny, { ...tiny, title: "x" })).toBe(false);
  });
});
