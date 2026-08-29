"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

/** The theme that the page shows now: the data-theme value if set, else the OS preference. */
function readTheme(): Theme {
  const stamped = document.documentElement.dataset.theme;
  if (stamped === "light" || stamped === "dark") return stamped;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const observer = new MutationObserver(onChange);
  mq.addEventListener("change", onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    mq.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

/** Changes between the light (Fog) and the dark (Fathom) token sets. */
export function ThemeToggle() {
  // The server snapshot is "light". The pre-paint script in layout.tsx
  // makes the DOM correct before this component hydrates.
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light" as Theme);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }

  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center rounded-control text-muted transition-colors duration-(--dur-micro) ease-(--ease) hover:text-text"
    >
      {/* A half-filled disc. It means "the other side" in each theme. */}
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.25" />
        <path d="M7 1a6 6 0 0 1 0 12Z" fill="currentColor" />
      </svg>
    </button>
  );
}
