import type { Transition, Variants } from "motion/react";

/** All durations are in this file. In seconds. */
export const durations = {
  micro: 0.16,
  confirm: 0.22,
  screen: 0.26,
} as const;

export const ease = [0.2, 0, 0, 1] as const;

export const screenTransition: Transition = { duration: durations.screen, ease };

export type Direction = 1 | -1;

/**
 * The question swap, with a direction. Forward: the next question comes up
 * from below. Back: it comes down from above. The `custom` value carries
 * the direction. The screen that leaves moves the same way as the screen
 * that enters.
 */
export const screenVariants: Variants = {
  enter: (dir: Direction) => ({ opacity: 0, y: 24 * dir }),
  center: { opacity: 1, y: 0 },
  exit: (dir: Direction) => ({ opacity: 0, y: -24 * dir }),
};

/** For reduced motion: a crossfade only. */
export const screenVariantsQuiet: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};
