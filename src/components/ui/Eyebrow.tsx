import { cn } from "@/lib/cn";

/** Small mono label above a heading. */
export function Eyebrow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("font-mono text-[12px] leading-none text-muted", className)}
      {...props}
    />
  );
}
