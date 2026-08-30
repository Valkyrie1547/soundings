// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadOrCreateRespondent } from "./respondent";

const STUDY = "vehicle-ownership";
const KEY = `soundings:rid:${STUDY}`;
const STORED = "11111111-1111-4111-8111-111111111111";
const FROM_URL = "22222222-2222-4222-8222-222222222222";
const CREATED = "33333333-3333-4333-8333-333333333333";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** A fetch stub. GET by id answers from `byId` (status, or a study id for 200), POST creates `CREATED`. */
function stubFetch(byId: Record<string, number | string>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as { studyId: string };
      return jsonResponse(201, { id: CREATED, studyId: body.studyId, surveyStatus: "in_progress" });
    }
    const id = url.split("/").pop()!;
    const entry = byId[id] ?? 404;
    if (typeof entry === "string") return jsonResponse(200, { id, studyId: entry, surveyStatus: "in_progress" });
    return entry === 200 ? jsonResponse(200, { id, studyId: STUDY, surveyStatus: "in_progress" }) : jsonResponse(entry, { error: "x" });
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
  it("creates a respondent for the study on the first visit and writes the id to storage and the URL", async () => {
    fetchMock = stubFetch({});
    vi.stubGlobal("fetch", fetchMock);
    const state = await loadOrCreateRespondent(STUDY);
    expect(state.id).toBe(CREATED);
    expect(localStorage.getItem(KEY)).toBe(CREATED);
    expect(window.location.search).toBe(`?rid=${CREATED}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ studyId: STUDY });
  });

  it("uses the stored id of this study and adds it to the URL", async () => {
    localStorage.setItem(KEY, STORED);
    fetchMock = stubFetch({ [STORED]: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const state = await loadOrCreateRespondent(STUDY);
    expect(state.id).toBe(STORED);
    expect(window.location.search).toBe(`?rid=${STORED}`);
  });

  it("keeps one respondent per study in storage", async () => {
    localStorage.setItem("soundings:rid:coffee-subscription", STORED);
    fetchMock = stubFetch({ [STORED]: "coffee-subscription" });
    vi.stubGlobal("fetch", fetchMock);
    const state = await loadOrCreateRespondent(STUDY);
    expect(state.id).toBe(CREATED);
    expect(localStorage.getItem("soundings:rid:coffee-subscription")).toBe(STORED);
    expect(localStorage.getItem(KEY)).toBe(CREATED);
  });

  it("ignores an id in the URL that belongs to a different study", async () => {
    window.history.replaceState(null, "", `/?rid=${FROM_URL}`);
    fetchMock = stubFetch({ [FROM_URL]: "coffee-subscription" });
    vi.stubGlobal("fetch", fetchMock);
    const state = await loadOrCreateRespondent(STUDY);
    expect(state.id).toBe(CREATED);
    expect(window.location.search).toBe(`?rid=${CREATED}`);
  });

  it("prefers the id in the URL over the stored id", async () => {
    localStorage.setItem(KEY, STORED);
    window.history.replaceState(null, "", `/?rid=${FROM_URL}`);
    fetchMock = stubFetch({ [STORED]: 200, [FROM_URL]: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const state = await loadOrCreateRespondent(STUDY);
    expect(state.id).toBe(FROM_URL);
    expect(localStorage.getItem(KEY)).toBe(FROM_URL);
  });

  it("ignores both ids when ?new is present and removes it from the URL", async () => {
    localStorage.setItem(KEY, STORED);
    window.history.replaceState(null, "", `/?rid=${FROM_URL}&new=1`);
    fetchMock = stubFetch({ [STORED]: 200, [FROM_URL]: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const state = await loadOrCreateRespondent(STUDY);
    expect(state.id).toBe(CREATED);
    expect(window.location.search).toBe(`?rid=${CREATED}`);
    expect(localStorage.getItem(KEY)).toBe(CREATED);
  });

  it("shares one request between parallel calls, so ?new=1 makes one respondent", async () => {
    window.history.replaceState(null, "", "/?new=1");
    fetchMock = stubFetch({});
    vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([loadOrCreateRespondent(STUDY), loadOrCreateRespondent(STUDY)]);
    expect(a.id).toBe(CREATED);
    expect(b.id).toBe(CREATED);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("creates a new respondent when the stored id is unknown", async () => {
    localStorage.setItem(KEY, STORED);
    fetchMock = stubFetch({ [STORED]: 404 });
    vi.stubGlobal("fetch", fetchMock);
    const state = await loadOrCreateRespondent(STUDY);
    expect(state.id).toBe(CREATED);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws on a server error instead of making a new respondent", async () => {
    localStorage.setItem(KEY, STORED);
    fetchMock = stubFetch({ [STORED]: 500 });
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadOrCreateRespondent(STUDY)).rejects.toThrow(/500/);
    expect(localStorage.getItem(KEY)).toBe(STORED);
  });
});
