"use client";

import { useCallback, useState } from "react";
import { parseStudy, type StudyConfig, type StudyIssue } from "@/lib/study";
import type { SimulationOutcome } from "@/lib/admin/simulate";

/**
 * The editor's state and actions. Validate and Publish go to the server,
 * so what the admin sees is what the API enforces. Preview parses locally
 * with the same schema.
 */
export function useStudyEditor(initialJson: string) {
  const [text, setText] = useState(initialJson);
  const [issues, setIssues] = useState<StudyIssue[] | null>(null);
  const [preview, setPreview] = useState<StudyConfig | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"validate" | "publish" | "simulate" | null>(null);
  const [simulation, setSimulation] = useState<SimulationOutcome | null>(null);

  const validate = useCallback(async () => {
    setBusy("validate");
    setMessage(null);
    setPreview(null);
    try {
      const res = await fetch("/api/admin/studies/validate", { method: "POST", body: text });
      const body = (await res.json()) as { ok: boolean; issues: StudyIssue[] };
      setIssues(body.issues);
      if (body.ok) setMessage("The document is valid.");
    } catch {
      setMessage("Validation request failed. Check the connection.");
    } finally {
      setBusy(null);
    }
  }, [text]);

  const showPreview = useCallback(() => {
    setMessage(null);
    const result = parseStudy(safeParse(text));
    if (!result.study) {
      setIssues(result.issues);
      setPreview(null);
      return;
    }
    setIssues(null);
    setPreview(result.study);
  }, [text]);

  const publish = useCallback(async () => {
    setBusy("publish");
    setMessage(null);
    try {
      const res = await fetch("/api/admin/studies", { method: "POST", body: text });
      const body = (await res.json()) as { id?: string; version?: number; error?: string; issues?: StudyIssue[] };
      if (res.ok) {
        setIssues(null);
        setMessage(`Published ${body.id} as version ${body.version}. Live at /s/${body.id}.`);
      } else {
        setIssues(body.issues ?? null);
        setMessage(body.error ?? `Publish failed (${res.status}).`);
      }
    } catch {
      setMessage("Publish request failed. Check the connection.");
    } finally {
      setBusy(null);
    }
  }, [text]);

  const simulate = useCallback(async (studyId: string, segment: string) => {
    setBusy("simulate");
    setMessage(null);
    setSimulation(null);
    try {
      const res = await fetch(`/api/admin/studies/${studyId}/simulate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ segment }),
      });
      const body = (await res.json()) as SimulationOutcome & { error?: string };
      if (res.ok) setSimulation(body);
      else setMessage(body.error ?? `Simulation failed (${res.status}).`);
    } catch {
      setMessage("Simulation request failed. Check the connection.");
    } finally {
      setBusy(null);
    }
  }, []);

  return { text, setText, issues, preview, message, busy, simulation, validate, showPreview, publish, simulate };
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
