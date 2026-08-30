import type { ShellStudy } from "@/components/layout/StudyShell";

/** The neutral frame for admin pages. Same product, no study accent. */
export const ADMIN_SHELL: ShellStudy = {
  name: "Soundings",
  title: "Study admin",
  theme: {
    accent: { light: "#444b52", dark: "#9aa4ad" },
    onAccent: { light: "#f8f9f9", dark: "#0e1316" },
  },
};
