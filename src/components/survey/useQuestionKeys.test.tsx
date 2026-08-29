// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { isReserved, nextFocusIndex, useQuestionKeys } from "./useQuestionKeys";

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = window) {
  const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(e);
  });
  return e;
}

/** Three option buttons wired to the hook. */
function Options({ enabled = true, onPick, onAdvance }: { enabled?: boolean; onPick: (i: number) => void; onAdvance: () => void }) {
  const { register } = useQuestionKeys({ count: 3, enabled, onPick, onAdvance });
  return (
    <div>
      {[0, 1, 2].map((i) => (
        <button key={i} ref={register(i)} data-i={i}>
          Option {i + 1}
        </button>
      ))}
      <input data-testid="text" />
    </div>
  );
}

function mount(enabled = true) {
  const onPick = vi.fn();
  const onAdvance = vi.fn();
  const view = render(<Options enabled={enabled} onPick={onPick} onAdvance={onAdvance} />);
  const buttons = Array.from(view.container.querySelectorAll("button"));
  return { onPick, onAdvance, buttons, input: view.getByTestId("text") };
}

afterEach(cleanup);

describe("nextFocusIndex", () => {
  it("starts at the first option on Down and the last on Up when nothing has focus", () => {
    expect(nextFocusIndex(-1, 1, 3)).toBe(0);
    expect(nextFocusIndex(-1, -1, 3)).toBe(2);
  });

  it("wraps at both ends", () => {
    expect(nextFocusIndex(2, 1, 3)).toBe(0);
    expect(nextFocusIndex(0, -1, 3)).toBe(2);
    expect(nextFocusIndex(1, 1, 3)).toBe(2);
  });
});

describe("isReserved", () => {
  it("reserves modified keys", () => {
    expect(isReserved(new KeyboardEvent("keydown", { key: "1", ctrlKey: true }))).toBe(true);
    expect(isReserved(new KeyboardEvent("keydown", { key: "1", metaKey: true }))).toBe(true);
    expect(isReserved(new KeyboardEvent("keydown", { key: "1", altKey: true }))).toBe(true);
    expect(isReserved(new KeyboardEvent("keydown", { key: "1" }))).toBe(false);
  });
});

describe("useQuestionKeys", () => {
  it("picks an option for a digit in range", () => {
    const { onPick } = mount();
    const e = press("2");
    expect(onPick).toHaveBeenCalledWith(1);
    expect(e.defaultPrevented).toBe(true);
  });

  it("ignores a digit out of range", () => {
    const { onPick } = mount();
    const e = press("4");
    expect(onPick).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });

  it("advances on Enter when no option has focus", () => {
    const { onAdvance } = mount();
    press("Enter");
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("does not advance on Enter when an option has focus", () => {
    const { onAdvance, buttons } = mount();
    act(() => buttons[1].focus());
    press("Enter");
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it("moves focus with the arrow keys and wraps", () => {
    const { buttons } = mount();
    press("ArrowDown");
    expect(document.activeElement).toBe(buttons[0]);
    press("ArrowDown");
    expect(document.activeElement).toBe(buttons[1]);
    press("ArrowUp");
    press("ArrowUp");
    expect(document.activeElement).toBe(buttons[2]);
  });

  it("goes to the last option on Up from no focus", () => {
    const { buttons } = mount();
    press("ArrowUp");
    expect(document.activeElement).toBe(buttons[2]);
  });

  it("ignores modified keys and keys typed in a text field", () => {
    const { onPick, onAdvance, input } = mount();
    press("1", { ctrlKey: true });
    press("1", {}, input);
    press("Enter", {}, input);
    expect(onPick).not.toHaveBeenCalled();
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it("does nothing when disabled", () => {
    const { onPick, onAdvance } = mount(false);
    press("1");
    press("Enter");
    expect(onPick).not.toHaveBeenCalled();
    expect(onAdvance).not.toHaveBeenCalled();
  });
});
