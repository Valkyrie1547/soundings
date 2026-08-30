"use client";

import { useState } from "react";

/** Copies the absolute respondent link of one study. */
export function CopyLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <button type="button" onClick={copy} className="text-muted underline-offset-4 hover:text-text hover:underline">
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}
