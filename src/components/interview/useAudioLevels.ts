"use client";

import { useEffect } from "react";

/**
 * Drives the audio-reactive rail without touching React state: one rAF loop
 * writes --agent-level and --mic-level (0–1) to the document, and CSS does
 * the rest. Disabled under reduced motion, where the rail stays still.
 */
export function useAudioLevels(
  active: boolean,
  getOutput: () => number,
  getInput: () => number,
) {
  useEffect(() => {
    const root = document.documentElement;
    const quiet = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!active || quiet) {
      root.style.setProperty("--agent-level", "0");
      root.style.setProperty("--mic-level", "0");
      return;
    }

    let frame = 0;
    let agent = 0;
    let mic = 0;
    const tick = () => {
      // Light smoothing so the weight breathes rather than flickers.
      agent = agent * 0.7 + clamp(getOutput()) * 0.3;
      mic = mic * 0.7 + clamp(getInput()) * 0.3;
      root.style.setProperty("--agent-level", agent.toFixed(3));
      root.style.setProperty("--mic-level", mic.toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      root.style.setProperty("--agent-level", "0");
      root.style.setProperty("--mic-level", "0");
    };
  }, [active, getOutput, getInput]);
}

function clamp(v: number) {
  return Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 0;
}
