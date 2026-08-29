"use client";

import { useEffect, useRef } from "react";

interface QuestionKeysOptions {
  count: number;
  enabled: boolean;
  /** Called when the user presses a digit 1..count, or Enter on an option that has focus. The index is 0-based. */
  onPick: (index: number) => void;
  /** Called when the user presses Enter and no option has focus. */
  onAdvance: () => void;
}

/** True when a modifier key is held or the event comes from a text field. Do not handle these events. */
function isReserved(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return true;
  const target = e.target as HTMLElement | null;
  return target !== null && ["INPUT", "TEXTAREA"].includes(target.tagName);
}

/** The index that gets focus after an arrow key. Focus wraps at both ends. */
function nextFocusIndex(focused: number, step: 1 | -1, count: number): number {
  if (focused === -1) return step === 1 ? 0 : count - 1;
  return (focused + step + count) % count;
}

/**
 * Keyboard control that all question types share:
 *   1-9    select an option
 *   Up/Down  move focus between options
 *   Enter  confirm the option that has focus (native click), or continue
 * Returns a ref setter. Use it to register each option button in order.
 */
export function useQuestionKeys({ count, enabled, onPick, onAdvance }: QuestionKeysOptions) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!enabled) return;

    function handleDigit(e: KeyboardEvent) {
      const index = Number(e.key) - 1;
      if (index >= count) return;
      e.preventDefault();
      onPick(index);
    }

    function handleArrow(e: KeyboardEvent) {
      e.preventDefault();
      const focused = refs.current.findIndex((el) => el === document.activeElement);
      const step = e.key === "ArrowDown" ? 1 : -1;
      refs.current[nextFocusIndex(focused, step, count)]?.focus();
    }

    function handleEnter(e: KeyboardEvent) {
      const focused = refs.current.some((el) => el === document.activeElement);
      if (focused) return; // The button's native click handles this.
      e.preventDefault();
      onAdvance();
    }

    function onKey(e: KeyboardEvent) {
      if (isReserved(e)) return;
      if (/^[1-9]$/.test(e.key)) return handleDigit(e);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") return handleArrow(e);
      if (e.key === "Enter") return handleEnter(e);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, enabled, onPick, onAdvance]);

  const register = (index: number) => (el: HTMLButtonElement | null) => {
    refs.current[index] = el;
  };

  return { register };
}
