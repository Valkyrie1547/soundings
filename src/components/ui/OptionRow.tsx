"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { KeyHint } from "./KeyHint";

interface OptionRowProps {
  label: string;
  /** The 1-based key. It shows in the badge and is bound on the keyboard. */
  hotkey: number;
  selected: boolean;
  /** True for a short time after a choice, before the screen advances. */
  confirming?: boolean;
  multi?: boolean;
  onSelect: () => void;
}

/**
 * One answer option. It is a real button, so Enter and Space work natively.
 * The parent hook handles digit keys and arrow-key focus.
 */
export const OptionRow = forwardRef<HTMLButtonElement, OptionRowProps>(function OptionRow(
  { label, hotkey, selected, confirming, multi, onSelect },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group flex w-full items-center gap-3.5 rounded-control border px-3.5 py-[11px] text-left",
        "text-[17px] leading-6 text-text",
        "transition-[border-color,background-color,transform] duration-(--dur-micro) ease-(--ease)",
        "hover:border-line-strong active:scale-[0.995]",
        selected
          ? "border-accent bg-surface-raised"
          : "border-line bg-surface",
        confirming && "border-accent",
      )}
    >
      <KeyHint active={selected}>{hotkey}</KeyHint>
      <span className="flex-1">{label}</span>
      {multi && (
        <span
          aria-hidden
          className={cn(
            "h-4 w-4 rounded-[3px] border transition-colors duration-(--dur-micro) ease-(--ease)",
            selected ? "border-accent bg-accent" : "border-line-strong",
          )}
        />
      )}
    </button>
  );
});
