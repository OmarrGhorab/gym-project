import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedUrlSearch } from "./use-debounced-url-search";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Stands in for the page: the hook commits a term, and the "server" only reports
 * it back on the next render, exactly as a URL round-trip does.
 */
function renderSearch(initial = "") {
  const commits: string[] = [];

  const view = renderHook(
    ({ value }: { value: string }) =>
      useDebouncedUrlSearch({
        onCommit: (next) => commits.push(next),
        value,
      }),
    { initialProps: { value: initial } },
  );

  return { commits, view };
}

describe("useDebouncedUrlSearch", () => {
  it("commits the typed term once the user stops", () => {
    const { commits, view } = renderSearch();

    act(() => view.result.current[1]("ahmed"));
    expect(commits).toEqual([]);

    act(() => vi.advanceTimersByTime(350));
    expect(commits).toEqual(["ahmed"]);
  });

  it("keeps characters typed while the previous search is still in flight", () => {
    const { commits, view } = renderSearch();

    // Types "ahm", pauses long enough for the search to fire...
    act(() => view.result.current[1]("ahm"));
    act(() => vi.advanceTimersByTime(350));
    expect(commits).toEqual(["ahm"]);

    // ...then keeps typing before the server has answered.
    act(() => view.result.current[1]("ahmed"));

    // The answer to the *old* term arrives. This is the regression: the echo used
    // to be mistaken for an outside change and reset the box to "ahm".
    act(() => view.rerender({ value: "ahm" }));
    expect(view.result.current[0]).toBe("ahmed");

    act(() => vi.advanceTimersByTime(350));
    expect(commits).toEqual(["ahm", "ahmed"]);
  });

  it("does not restart the debounce when the commit callback identity changes", () => {
    const commits: string[] = [];
    const view = renderHook(
      ({ value }: { value: string }) =>
        useDebouncedUrlSearch({
          // A fresh closure every render, as a callback built from URL state is.
          onCommit: (next) => commits.push(next),
          value,
        }),
      { initialProps: { value: "" } },
    );

    act(() => view.result.current[1]("ahmed"));
    act(() => vi.advanceTimersByTime(200));

    // A re-render mid-wait must not reset the clock.
    act(() => view.rerender({ value: "" }));
    act(() => vi.advanceTimersByTime(150));

    expect(commits).toEqual(["ahmed"]);
  });

  it("adopts a genuine outside change, such as back navigation", () => {
    const { commits, view } = renderSearch("ahmed");

    act(() => view.rerender({ value: "sara" }));

    expect(view.result.current[0]).toBe("sara");

    // Adopting an outside value must not echo it straight back as a new search.
    act(() => vi.advanceTimersByTime(350));
    expect(commits).toEqual([]);
  });

  it("commits an empty term when the box is cleared", () => {
    const { commits, view } = renderSearch("ahmed");

    act(() => view.result.current[1](""));
    act(() => vi.advanceTimersByTime(350));

    expect(commits).toEqual([""]);
  });

  it("only commits the final term when typing without pausing", () => {
    const { commits, view } = renderSearch();

    for (const term of ["a", "ah", "ahm", "ahme", "ahmed"]) {
      act(() => view.result.current[1](term));
      act(() => vi.advanceTimersByTime(100));
    }

    act(() => vi.advanceTimersByTime(350));

    expect(commits).toEqual(["ahmed"]);
  });
});
