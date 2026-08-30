import { afterEach, describe, expect, it, vi } from "vitest";
import { makeStudy } from "@/test/fixtures";

vi.mock("@/lib/study/registry", () => ({
  publishStudy: vi.fn(),
  loadLiveStudy: vi.fn(),
}));
vi.mock("@/lib/admin/simulate", () => ({
  simulateHappyPath: vi.fn(),
}));

import * as registry from "@/lib/study/registry";
import * as sim from "@/lib/admin/simulate";
import { POST as postValidate } from "./studies/validate/route";
import { POST as postPublish } from "./studies/route";
import { POST as postSimulate } from "./studies/[id]/simulate/route";

const publish = vi.mocked(registry.publishStudy);
const loadLive = vi.mocked(registry.loadLiveStudy);
const simulate = vi.mocked(sim.simulateHappyPath);

function post(body: string) {
  return new Request("http://test/api/admin/studies", { method: "POST", body });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/studies/validate", () => {
  it("returns issues with dotted paths for a broken document", async () => {
    const broken = { ...makeStudy(), outcomePrecedence: ["a", "ghost"] };
    const res = await postValidate(post(JSON.stringify(broken)));
    const body = (await res.json()) as { ok: boolean; issues: { path: string; message: string }[] };
    expect(body.ok).toBe(false);
    expect(body.issues).toContainEqual({ path: "outcomePrecedence.1", message: 'unknown segment "ghost"' });
  });

  it("reports a body that is not JSON as one issue", async () => {
    const body = (await (await postValidate(post("{oops"))).json()) as { ok: boolean; issues: unknown[] };
    expect(body.ok).toBe(false);
    expect(body.issues).toHaveLength(1);
  });

  it("accepts a valid document", async () => {
    const body = (await (await postValidate(post(JSON.stringify(makeStudy())))).json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});

describe("POST /api/admin/studies", () => {
  it("refuses an invalid document with its issues and does not publish", async () => {
    const res = await postPublish(post(JSON.stringify({ id: "x" })));
    expect(res.status).toBe(400);
    expect(publish).not.toHaveBeenCalled();
  });

  it("returns 409 when the content equals the live version", async () => {
    publish.mockResolvedValue({ ok: false, reason: "unchanged" });
    const res = await postPublish(post(JSON.stringify(makeStudy())));
    expect(res.status).toBe(409);
  });

  it("publishes and returns the assigned version", async () => {
    publish.mockResolvedValue({ ok: true, version: 4 });
    const res = await postPublish(post(JSON.stringify(makeStudy())));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: "tiny", version: 4 });
  });
});

describe("POST /api/admin/studies/[id]/simulate", () => {
  const ctx = (id: string) => ({ params: Promise.resolve({ id }) }) as never;
  const req = (segment: unknown) =>
    new Request("http://test/x", { method: "POST", body: JSON.stringify({ segment }) });

  it("404s an unknown study and 400s an unknown segment", async () => {
    loadLive.mockResolvedValue(null);
    expect((await postSimulate(req("a"), ctx("ghost"))).status).toBe(404);
    loadLive.mockResolvedValue(makeStudy());
    expect((await postSimulate(req("ghost"), ctx("tiny"))).status).toBe(400);
    expect(simulate).not.toHaveBeenCalled();
  });

  it("runs one simulation, then rate-limits the next within a minute", async () => {
    loadLive.mockResolvedValue(makeStudy());
    simulate.mockResolvedValue({ pass: true, markedIds: ["q2", "q3"], expectedIds: ["q2", "q3"], finishCalls: 1, turns: [] });
    const first = await postSimulate(req("a"), ctx("tiny"));
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ pass: true });
    const second = await postSimulate(req("a"), ctx("tiny"));
    expect(second.status).toBe(429);
    expect(simulate).toHaveBeenCalledTimes(1);
  });
});
