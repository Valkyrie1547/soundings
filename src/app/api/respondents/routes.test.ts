import { afterEach, describe, expect, it, vi } from "vitest";
import type { RespondentState } from "@/lib/survey/persist";

vi.mock("@/lib/survey/persist", () => ({
  createRespondent: vi.fn(),
  loadRespondent: vi.fn(),
  saveAnswer: vi.fn(),
}));
vi.mock("@/lib/interview/persist", () => ({
  startInterviewSession: vi.fn(),
  markAnswered: vi.fn(),
  endInterviewSession: vi.fn(),
  loadTranscript: vi.fn(),
}));

import * as survey from "@/lib/survey/persist";
import * as interview from "@/lib/interview/persist";
import { GET as getRespondent } from "./[id]/route";
import { PUT as putAnswer } from "./[id]/answers/route";
import { POST as postStart } from "./[id]/interview/start/route";
import { POST as postProgress } from "./[id]/interview/progress/route";
import { POST as postEnd } from "./[id]/interview/end/route";

const ID = "3b241101-e2bb-4255-8caf-4136c566a962";
const SESSION = "9f1c2d3e-4b5a-4c6d-8e7f-a0b1c2d3e4f5";
const mocked = {
  load: vi.mocked(survey.loadRespondent),
  save: vi.mocked(survey.saveAnswer),
  start: vi.mocked(interview.startInterviewSession),
  mark: vi.mocked(interview.markAnswered),
  end: vi.mocked(interview.endInterviewSession),
};

function state(over: Partial<RespondentState> = {}): RespondentState {
  return {
    id: ID,
    surveyStatus: "qualified",
    segment: "bmw_customer",
    interviewStatus: "not_started",
    answers: {},
    interviewProgress: [],
    transcriptConfirmed: [],
    interviewGuide: [],
    ...over,
  };
}

/** Builds a request and the route context for one respondent id. */
function call(id: string, method: string, body?: unknown) {
  const req = new Request(`http://test/api/respondents/${id}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const ctx = { params: Promise.resolve({ id }) };
  return [req, ctx] as [Request, never];
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/respondents/[id]", () => {
  it("rejects a bad id", async () => {
    const res = await getRespondent(...call("nope", "GET"));
    expect(res.status).toBe(400);
    expect(mocked.load).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown respondent", async () => {
    mocked.load.mockResolvedValue(null);
    const res = await getRespondent(...call(ID, "GET"));
    expect(res.status).toBe(404);
  });

  it("returns the state", async () => {
    mocked.load.mockResolvedValue(state());
    const res = await getRespondent(...call(ID, "GET"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: ID, surveyStatus: "qualified" });
  });
});

describe("PUT /api/respondents/[id]/answers", () => {
  it.each([
    ["unknown question", { questionId: "shoe_size", answer: "yes" }],
    ["array for a single select", { questionId: "age", answer: ["25_34"] }],
    ["string for a multi select", { questionId: "brands", answer: "bmw" }],
    ["empty array", { questionId: "brands", answer: [] }],
    ["unknown option", { questionId: "age", answer: "under_5" }],
    ["unknown option inside an array", { questionId: "brands", answer: ["bmw", "lada"] }],
  ])("rejects %s", async (_, body) => {
    const res = await putAnswer(...call(ID, "PUT", body));
    expect(res.status).toBe(400);
    expect(mocked.save).not.toHaveBeenCalled();
  });

  it("rejects a body that is not JSON", async () => {
    const req = new Request(`http://test/api/respondents/${ID}`, { method: "PUT", body: "{" });
    const res = await putAnswer(req, { params: Promise.resolve({ id: ID }) } as never);
    expect(res.status).toBe(400);
  });

  it("returns 404 when the respondent does not exist", async () => {
    mocked.save.mockResolvedValue(null);
    const res = await putAnswer(...call(ID, "PUT", { questionId: "age", answer: "25_34" }));
    expect(res.status).toBe(404);
  });

  it("saves a valid answer and returns the new state", async () => {
    mocked.save.mockResolvedValue(state({ surveyStatus: "in_progress", segment: null }));
    const res = await putAnswer(...call(ID, "PUT", { questionId: "brands", answer: ["bmw", "toyota"] }));
    expect(res.status).toBe(200);
    expect(mocked.save).toHaveBeenCalledWith(ID, "brands", ["bmw", "toyota"]);
  });
});

describe("POST /api/respondents/[id]/interview/start", () => {
  it("refuses a respondent who has not qualified", async () => {
    mocked.load.mockResolvedValue(state({ surveyStatus: "in_progress", segment: null }));
    const res = await postStart(...call(ID, "POST"));
    expect(res.status).toBe(409);
    expect(mocked.start).not.toHaveBeenCalled();
  });

  it("refuses a completed interview", async () => {
    mocked.load.mockResolvedValue(state({ interviewStatus: "completed" }));
    const res = await postStart(...call(ID, "POST"));
    expect(res.status).toBe(409);
  });

  it("opens a session for a qualified respondent", async () => {
    mocked.load.mockResolvedValue(state({ segment: "potential_bmw_customer" }));
    mocked.start.mockResolvedValue({ sessionId: SESSION, attemptNo: 1, signedUrl: "wss://x", dynamicVariables: {} as never, progress: [] });
    const res = await postStart(...call(ID, "POST"));
    expect(res.status).toBe(200);
    expect(mocked.start).toHaveBeenCalledWith(ID, "potential_bmw_customer");
    expect(await res.json()).toMatchObject({ sessionId: SESSION, signedUrl: "wss://x" });
  });
});

describe("POST /api/respondents/[id]/interview/progress", () => {
  it.each(["q1", "q99", 7, null])("rejects question %j", async (questionId) => {
    mocked.load.mockResolvedValue(state());
    const res = await postProgress(...call(ID, "POST", { questionId, summary: "x" }));
    expect(res.status).toBe(400);
    expect(mocked.mark).not.toHaveBeenCalled();
  });

  it("returns 404 when the respondent has no segment", async () => {
    mocked.load.mockResolvedValue(state({ segment: null }));
    const res = await postProgress(...call(ID, "POST", { questionId: "q2" }));
    expect(res.status).toBe(404);
  });

  it("marks a question with a summary cut to 500 characters", async () => {
    mocked.load.mockResolvedValue(state());
    mocked.mark.mockResolvedValue([{ questionId: "q2", summary: "s", source: "tool" }]);
    const res = await postProgress(...call(ID, "POST", { questionId: "q2", summary: "x".repeat(600) }));
    expect(res.status).toBe(200);
    expect(mocked.mark).toHaveBeenCalledWith(ID, "q2", "x".repeat(500));
    expect(await res.json()).toEqual({ progress: [{ questionId: "q2", summary: "s", source: "tool" }] });
  });

  it("stores a null summary when none is given", async () => {
    mocked.load.mockResolvedValue(state());
    mocked.mark.mockResolvedValue([]);
    await postProgress(...call(ID, "POST", { questionId: "q7" }));
    expect(mocked.mark).toHaveBeenCalledWith(ID, "q7", null);
  });
});

describe("POST /api/respondents/[id]/interview/end", () => {
  it.each([
    ["a bad session id", { sessionId: "nope", reason: "completed" }],
    ["an unknown reason", { sessionId: SESSION, reason: "vanished" }],
    ["a missing reason", { sessionId: SESSION }],
  ])("rejects %s", async (_, body) => {
    mocked.load.mockResolvedValue(state());
    const res = await postEnd(...call(ID, "POST", body));
    expect(res.status).toBe(400);
    expect(mocked.end).not.toHaveBeenCalled();
  });

  it("closes the segment and returns the gate result", async () => {
    mocked.load.mockResolvedValue(state());
    mocked.end.mockResolvedValue({ complete: true, progress: [], backstop: ["q6"] });
    const res = await postEnd(...call(ID, "POST", { sessionId: SESSION, conversationId: "conv_1", reason: "dropped" }));
    expect(res.status).toBe(200);
    expect(mocked.end).toHaveBeenCalledWith(ID, "bmw_customer", SESSION, "conv_1", "dropped");
    expect(await res.json()).toEqual({ complete: true, progress: [], backstop: ["q6"] });
  });

  it("passes a null conversation id when none is given", async () => {
    mocked.load.mockResolvedValue(state());
    mocked.end.mockResolvedValue({ complete: false, progress: [], backstop: [] });
    await postEnd(...call(ID, "POST", { sessionId: SESSION, reason: "user_ended" }));
    expect(mocked.end).toHaveBeenCalledWith(ID, "bmw_customer", SESSION, null, "user_ended");
  });
});
