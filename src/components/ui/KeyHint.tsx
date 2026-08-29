import { cn } from "@/lib/cn";

interface KeyHintProps {
  children: React.ReactNode;
  /** True when the key's option is selected. The badge is then filled. */
  active?: boolean;
  className?: string;
}

/** A keyboard key, drawn as a small badge. It is always visible. It is not a tooltip. */
export function KeyHint({ children, active, className }: KeyHintProps) {
  return (
    <kbd
      className={cn(
        "inline-grid h-[22px] min-w-[22px] place-items-center rounded-key border px-1.5",
        "font-mono text-[12px] leading-none transition-colors duration-(--dur-micro) ease-(--ease)",
        active
          ? "border-accent bg-accent text-on-accent"
          : "border-line bg-transparent text-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
