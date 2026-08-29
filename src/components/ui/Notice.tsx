import { cn } from "@/lib/cn";

interface NoticeProps {
  title: string;
  body?: string;
  className?: string;
}

/** A quiet, in-frame message for errors and empty states. Explains, doesn't apologise. */
export function Notice({ title, body, className }: NoticeProps) {
  return (
    <div
      role="status"
      className={cn(
        "max-w-[560px] rounded-control border border-line bg-surface px-4 py-3",
        className,
      )}
    >
      <p className="text-[15px] font-medium text-text">{title}</p>
      {body && <p className="mt-1 text-[14px] leading-6 text-muted">{body}</p>}
    </div>
  );
}
