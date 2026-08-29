"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import type { RespondentState } from "@/lib/survey/persist";
import { loadOrCreateRespondent } from "@/lib/client/respondent";
import { endInterview, reportProgress, startInterview } from "@/lib/client/interview";
import { CLIENT_TOOLS } from "@/lib/interview/agent-config";
import { StudyShell } from "@/components/layout/StudyShell";
import { Notice } from "@/components/ui/Notice";
import { InterviewScreen, type InterviewPhase } from "./InterviewScreen";
import { useAudioLevels } from "./useAudioLevels";

/**
 * The interview state machine. The server stores each important transition:
 * session open, each answered question, and session close. The client holds
 * no state that the flow depends on. A refresh, a closed tab, and a lost
 * connection all go to the same resume path on the next visit.
 */
export function InterviewFlow() {
  return (
    <ConversationProvider>
      <Interview />
    </ConversationProvider>
  );
}

function Interview() {
  const router = useRouter();
  const [respondent, setRespondent] = useState<RespondentState | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [phase, setPhase] = useState<InterviewPhase>("loading");
  const [answered, setAnswered] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // True after the agent calls finish_interview. The call ends when the agent stops speaking.
  const [finishPending, setFinishPending] = useState(false);

  // Session data that callbacks read without a new binding.
  const sessionIdRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const intentRef = useRef<"finish" | "pause" | null>(null);
  const answeredRef = useRef<string[]>([]);
  useEffect(() => {
    answeredRef.current = answered;
  }, [answered]);

  // Load the respondent. Go to a different page when this page is not theirs to see.
  useEffect(() => {
    let cancelled = false;
    loadOrCreateRespondent()
      .then((state) => {
        if (cancelled) return;
        if (state.surveyStatus !== "qualified") return router.replace("/");
        if (state.interviewStatus === "completed") return router.replace("/transcript");
        setRespondent(state);
        setAnswered(state.interviewProgress);
        setPhase(state.interviewStatus === "in_progress" ? "resume" : "ready");
      })
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
    };
  }, [router]);

  const guide = respondent?.interviewGuide ?? [];
  const complete = guide.length > 0 && guide.every((q) => answered.includes(q.id));

  /** Closes the segment on the server and decides where the UI goes next. */
  const closeSegment = useCallback(
    async (reason: "completed" | "dropped" | "user_ended") => {
      if (!respondent || !sessionIdRef.current) return;
      const sessionId = sessionIdRef.current;
      sessionIdRef.current = null;
      try {
        const result = await endInterview(respondent.id, sessionId, conversationIdRef.current, reason);
        setAnswered(result.progress.map((p) => p.questionId));
        if (result.complete) {
          router.push("/transcript");
          return;
        }
        setPhase(reason === "dropped" ? "interrupted" : reason === "completed" ? "incomplete" : "paused");
      } catch {
        setPhase("interrupted");
      } finally {
        conversationIdRef.current = null;
      }
    },
    [respondent, router],
  );

  const conversation = useConversation({
    clientTools: {
      [CLIENT_TOOLS.markAnswered]: async (params: { question_id?: string; summary?: string }) => {
        if (!respondent || !params.question_id) return;
        const optimistic = [...new Set([...answeredRef.current, params.question_id])];
        setAnswered(optimistic);
        try {
          const { progress } = await reportProgress(respondent.id, params.question_id, params.summary ?? null);
          setAnswered(progress.map((p) => p.questionId));
        } catch {
          // Keep the local mark. The server gate checks again at the end.
        }
      },
      [CLIENT_TOOLS.finish]: async () => {
        intentRef.current = "finish";
        setFinishPending(true);
      },
    },
    onConnect: ({ conversationId }) => {
      conversationIdRef.current = conversationId;
      setFinishPending(false);
      setPhase("live");
    },
    onDisconnect: (details) => {
      const intent = intentRef.current;
      intentRef.current = null;
      if (details.reason === "error") return void closeSegment("dropped");
      if (intent === "finish") return void closeSegment("completed");
      if (intent === "pause") return void closeSegment("user_ended");
      // The agent ended the call. Either it completed, or the platform stopped it (for example at the maximum duration).
      void closeSegment("completed");
    },
    onError: (message) => setError(message),
  });

  const { startSession, endSession, getInputVolume, getOutputVolume, isSpeaking, status } = conversation;
  useAudioLevels(phase === "live", getOutputVolume, getInputVolume);

  // The agent calls the finish tool while its closing words still play. Wait until
  // it is silent for a moment, then end the session. A hard limit stops a long wait.
  useEffect(() => {
    if (!finishPending || isSpeaking) return;
    const t = window.setTimeout(() => endSession(), 1500);
    return () => window.clearTimeout(t);
  }, [finishPending, isSpeaking, endSession]);
  useEffect(() => {
    if (!finishPending) return;
    const t = window.setTimeout(() => endSession(), 20000);
    return () => window.clearTimeout(t);
  }, [finishPending, endSession]);

  const begin = useCallback(async () => {
    if (!respondent) return;
    setError(null);
    setPhase("connecting");
    try {
      // Request the microphone here. A refusal then shows a clear screen, not a dead session.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setPhase("mic_denied");
      return;
    }
    try {
      const session = await startInterview(respondent.id);
      sessionIdRef.current = session.sessionId;
      setAnswered(session.progress.map((p) => p.questionId));
      startSession({
        signedUrl: session.signedUrl,
        connectionType: "websocket",
        dynamicVariables: session.dynamicVariables,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the interview.");
      setPhase(answered.length > 0 ? "resume" : "ready");
    }
  }, [respondent, startSession, answered.length]);

  const pause = useCallback(() => {
    intentRef.current = "pause";
    endSession();
  }, [endSession]);

  const finish = useCallback(() => {
    intentRef.current = "finish";
    endSession();
  }, [endSession]);

  // The tab closes during a call. Record the drop, so the next visit resumes correctly.
  useEffect(() => {
    const onUnload = () => {
      if (sessionIdRef.current && respondent) {
        void endInterview(respondent.id, sessionIdRef.current, conversationIdRef.current, "dropped");
      }
    };
    window.addEventListener("pagehide", onUnload);
    return () => window.removeEventListener("pagehide", onUnload);
  }, [respondent]);

  const stage =
    guide.length === 0
      ? "Interview"
      : `Interview · ${answered.filter((id) => guide.some((q) => q.id === id)).length} of ${guide.length} answered`;
  const answeredCount = answered.filter((id) => guide.some((q) => q.id === id)).length;

  return (
    <StudyShell
      stage={stage}
      steps={Math.max(guide.length, 1)}
      current={Math.min(answeredCount, Math.max(guide.length - 1, 0))}
      audio={phase === "live"}
    >
      {loadFailed && (
        <div className="flex flex-1 items-center">
          <Notice title="Couldn't load your session" body="The server didn't respond. Reload the page to try again." />
        </div>
      )}
      {respondent && (
        <InterviewScreen
          phase={phase}
          guide={guide}
          answered={answered}
          complete={complete}
          isSpeaking={isSpeaking}
          connectionStatus={status}
          error={error}
          onBegin={begin}
          onPause={pause}
          onFinish={finish}
        />
      )}
    </StudyShell>
  );
}
