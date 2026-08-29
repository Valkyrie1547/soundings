import { cn } from "@/lib/cn";

type Variant = "primary" | "quiet";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const styles: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent border-accent hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100",
  quiet: "bg-transparent text-muted border-transparent hover:text-text",
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-control border px-4 text-[14px] font-medium",
        "transition-[filter,color,opacity] duration-(--dur-micro) ease-(--ease)",
        "disabled:cursor-not-allowed",
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
