// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadOrCreateRespondent } from "./respondent";

const STORED = "11111111-1111-4111-8111-111111111111";
const FROM_URL = "22222222-2222-4222-8222-222222222222";
const CREATED = "33333333-3333-4333-8333-333333333333";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** A fetch stub. GET by id answers from `byId`, POST creates `CREATED`. */
function stubFetch(byId: Record<string, number>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "POST") return jsonResponse(201, { id: CREATED, surveyStatus: "in_progress" });
    const id = url.split("/").pop()!;
    const status = byId[id] ?? 404;
    return status === 200 ? jsonResponse(200, { id, surveyStatus: "in_progress" }) : jsonResponse(status, { error: "x" });
  });
}

let fetchMock: ReturnType<typeof stubFetch>;

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadOrCreateRespondent", () => {
  it("creates a respondent on the first visit and writes the id to storage and the URL", async () => {
    fetchMock = stubFetch({});
    vi.stubGlobal("fetch", fetchMock);
    const state = await loadOrCreateRespondent();
    expect(state.id).toBe(CREATED);
    expect(localStorage.getItem("soundings:rid")).toBe(CREATED);
    expect(window.location.search).toBe(`?rid=${CREATED}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses the stored id and adds it to the URL", async () => {
    localStorage.setItem("soundings:rid", STORED);
    fetchMock = stubFetch({ [STORED]: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const state = await loadOrCreateRespondent();
    expect(state.id).toBe(STORED);
    expect(window.location.search).toBe(`?rid=${STORED}`);
  });

  it("prefers the id in the URL over the stored id", async () => {
    localStorage.setItem("soundings:rid", STORED);
    window.history.replaceState(null, "", `/?rid=${FROM_URL}`);
    fetchMock = stubFetch({ [STORED]: 200, [FROM_URL]: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const state = await loadOrCreateRespondent();
    expect(state.id).toBe(FROM_URL);
    expect(localStorage.getItem("soundings:rid")).toBe(FROM_URL);
  });

  it("ignores both ids when ?new is present and removes it from the URL", async () => {
    localStorage.setItem("soundings:rid", STORED);
    window.history.replaceState(null, "", `/?rid=${FROM_URL}&new=1`);
    fetchMock = stubFetch({ [STORED]: 200, [FROM_URL]: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const state = await loadOrCreateRespondent();
    expect(state.id).toBe(CREATED);
    expect(window.location.search).toBe(`?rid=${CREATED}`);
    expect(localStorage.getItem("soundings:rid")).toBe(CREATED);
  });

  it("creates a new respondent when the stored id is unknown", async () => {
    localStorage.setItem("soundings:rid", STORED);
    fetchMock = stubFetch({ [STORED]: 404 });
    vi.stubGlobal("fetch", fetchMock);
    const state = await loadOrCreateRespondent();
    expect(state.id).toBe(CREATED);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws on a server error instead of making a new respondent", async () => {
    localStorage.setItem("soundings:rid", STORED);
    fetchMock = stubFetch({ [STORED]: 500 });
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadOrCreateRespondent()).rejects.toThrow(/500/);
    expect(localStorage.getItem("soundings:rid")).toBe(STORED);
  });
});
