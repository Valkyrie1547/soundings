import type { Transition, Variants } from "motion/react";

/** All timing lives here so the walkthrough has one file to point at. */
export const durations = {
  micro: 0.16,
  confirm: 0.22,
  screen: 0.26,
} as const;

export const ease = [0.2, 0, 0, 1] as const;

export const screenTransition: Transition = { duration: durations.screen, ease };

export type Direction = 1 | -1;

/**
 * Directional question swap. Forward: the next question rises from below.
 * Back: it settles from above. `custom` carries the direction so the
 * exiting screen leaves the way the entering one arrives.
 */
export const screenVariants: Variants = {
  enter: (dir: Direction) => ({ opacity: 0, y: 24 * dir }),
  center: { opacity: 1, y: 0 },
  exit: (dir: Direction) => ({ opacity: 0, y: -24 * dir }),
};

/** Reduced motion: crossfade only. */
export const screenVariantsQuiet: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};
