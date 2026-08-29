"use client";

import { useEffect, useRef } from "react";

interface QuestionKeysOptions {
  count: number;
  enabled: boolean;
  /** Digit 1..count pressed, or Enter on a focused option (0-based). */
  onPick: (index: number) => void;
  /** Enter pressed with no option focused. */
  onAdvance: () => void;
}

/**
 * Keyboard-first interaction shared by every question type:
 *   1–9   pick an option
 *   ↑ ↓   move focus between options
 *   ↵     confirm (native click on the focused option) or continue
 * Returns a ref-setter to register option buttons in order.
 */
export function useQuestionKeys({ count, enabled, onPick, onAdvance }: QuestionKeysOptions) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!enabled) return;

    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;

      const focused = refs.current.findIndex((el) => el === document.activeElement);

      if (/^[1-9]$/.test(e.key)) {
        const index = Number(e.key) - 1;
        if (index < count) {
          e.preventDefault();
          onPick(index);
        }
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        const next = focused === -1 ? (step === 1 ? 0 : count - 1) : (focused + step + count) % count;
        refs.current[next]?.focus();
        return;
      }

      if (e.key === "Enter" && focused === -1) {
        e.preventDefault();
        onAdvance();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, enabled, onPick, onAdvance]);

  const register = (index: number) => (el: HTMLButtonElement | null) => {
    refs.current[index] = el;
  };

  return { register };
}
