"use client";

import * as React from "react";

/**
 * Drives a search box whose term lives in the URL and is applied on the server.
 *
 * The naive version of this — local state plus an effect that copies the URL
 * value back into it — drops characters. Search runs server-side, so a committed
 * term returns as a new prop once the round-trip finishes, and that echo is
 * indistinguishable from someone else changing the search. Syncing it back into
 * the box overwrites everything typed while the request was in flight, so typing
 * quickly leaves the input visibly short of its tail and searching the wrong term.
 *
 * Remembering the last term this hook committed tells the two apart: an incoming
 * value we sent is ignored, and only a genuine outside change — back/forward
 * navigation, a filter reset — moves the cursor out from under the user.
 */
export function useDebouncedUrlSearch({
  delay = 350,
  onCommit,
  value,
}: {
  delay?: number;
  onCommit: (next: string) => void;
  value: string;
}) {
  const [draft, setDraft] = React.useState(value);
  const lastCommitted = React.useRef(value);

  // Callers rebuild `onCommit` whenever the URL changes. Reading it from a ref
  // keeps it out of the debounce dependencies, where a fresh identity would
  // restart the timer every time our own navigation landed and roughly double
  // the wait for anyone still typing.
  const onCommitRef = React.useRef(onCommit);

  React.useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  React.useEffect(() => {
    if (value === lastCommitted.current) {
      return;
    }

    lastCommitted.current = value;
    setDraft(value);
  }, [value]);

  React.useEffect(() => {
    if (draft === lastCommitted.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      lastCommitted.current = draft;
      onCommitRef.current(draft);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [delay, draft]);

  return [draft, setDraft] as const;
}
