"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MicStatus = "idle" | "listening" | "denied";

/** True when the level is loud enough to count as speech. */
const HEARD_THRESHOLD = 0.08;

/**
 * A microphone check for the pre-flight screen. `start()` opens the mic and
 * an analyser. Each animation frame writes the level (0 to 1) to
 * `levelRef.current` and to `--mic-level` on the given element. `heard`
 * becomes true once, when the respondent speaks. `stop()` releases the mic.
 */
export function useMicLevel() {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [heard, setHeard] = useState(false);
  const meterRef = useRef<HTMLElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    stop();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setStatus("denied");
      return;
    }
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    let frame = 0;
    let smoothed = 0;

    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      smoothed = smoothed * 0.6 + rms(samples) * 0.4;
      meterRef.current?.style.setProperty("--mic-level", smoothed.toFixed(3));
      if (smoothed > HEARD_THRESHOLD) setHeard(true);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    cleanupRef.current = () => {
      cancelAnimationFrame(frame);
      stream.getTracks().forEach((t) => t.stop());
      void context.close();
      meterRef.current?.style.setProperty("--mic-level", "0");
    };
    setHeard(false);
    setStatus("listening");
  }, [stop]);

  useEffect(() => () => cleanupRef.current?.(), []);

  return { status, heard, meterRef, start, stop };
}

/** Root mean square of 8-bit PCM samples, scaled so normal speech reaches about 0.3. */
function rms(samples: Uint8Array): number {
  let sum = 0;
  for (const s of samples) {
    const v = (s - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / samples.length) * 3);
}
