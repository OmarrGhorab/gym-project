"use client";

import { useEffect, useRef } from "react";

import {
  decodeScannerKey,
  isEditableTarget,
  isScanTerminator,
  SCAN_MAX_KEY_GAP_MS,
  SCAN_MIN_LENGTH,
  SCAN_QUIET_FLUSH_MS,
} from "@/lib/scanner-keyboard";

type Options = {
  /** Called with the decoded payload once a scan completes. */
  onScan: (value: string) => void;
  /** Live buffer, for showing the operator that a scan is landing. */
  onBufferChange?: (buffer: string) => void;
  /** The scanner's own field — its own handlers own those keystrokes. */
  ignoreRef?: React.RefObject<HTMLElement | null>;
  enabled?: boolean;
};

/**
 * Capture a keyboard-wedge barcode scanner anywhere on the page.
 *
 * Listening on the document rather than a focused input is the point: the desk
 * operator clicks a dropdown or a button between scans, and a field-scoped
 * listener then silently drops every badge until someone notices and clicks
 * back. Keystrokes are still left alone while the user is typing in a form
 * field, so this never competes with manual entry.
 */
export function useKeyboardWedgeScanner({ enabled = true, ignoreRef, onBufferChange, onScan }: Options) {
  // Kept in refs so the document listener is installed once instead of being
  // torn down and rebuilt on every keystroke.
  const bufferRef = useRef("");
  const lastKeyAtRef = useRef(0);
  const quietTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScanRef = useRef(onScan);
  const onBufferChangeRef = useRef(onBufferChange);

  useEffect(() => {
    onScanRef.current = onScan;
    onBufferChangeRef.current = onBufferChange;
  }, [onScan, onBufferChange]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function setBuffer(next: string) {
      bufferRef.current = next;
      onBufferChangeRef.current?.(next);
    }

    function flush() {
      const value = bufferRef.current;
      setBuffer("");

      if (value.length >= SCAN_MIN_LENGTH) {
        onScanRef.current(value);
      }
    }

    function cancelQuietFlush() {
      if (quietTimerRef.current !== null) {
        clearTimeout(quietTimerRef.current);
        quietTimerRef.current = null;
      }
    }

    function scheduleQuietFlush() {
      cancelQuietFlush();

      // Scanners without an Enter suffix never terminate the burst themselves.
      quietTimerRef.current = setTimeout(flush, SCAN_QUIET_FLUSH_MS);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const target = event.target;

      if (ignoreRef?.current && target instanceof Node && ignoreRef.current.contains(target)) {
        return;
      }

      // The user is typing somewhere on purpose — notes, a lookup search box.
      if (isEditableTarget(target)) {
        return;
      }

      const now = event.timeStamp || performance.now();
      const gap = lastKeyAtRef.current === 0 ? Number.POSITIVE_INFINITY : now - lastKeyAtRef.current;
      lastKeyAtRef.current = now;

      // Too slow to be a machine: whatever came before was not part of this.
      if (gap > SCAN_MAX_KEY_GAP_MS) {
        setBuffer("");
      }

      if (isScanTerminator(event.key)) {
        if (bufferRef.current.length >= SCAN_MIN_LENGTH) {
          // Tab would move focus and Enter would submit the form mid-scan.
          event.preventDefault();
          cancelQuietFlush();
          flush();
        }
        return;
      }

      const char = decodeScannerKey(event);

      if (char === null) {
        return;
      }

      // Stops "/" opening quick-find and Space scrolling the page mid-burst.
      event.preventDefault();
      setBuffer(bufferRef.current + char);
      scheduleQuietFlush();
    }

    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      cancelQuietFlush();
    };
  }, [enabled, ignoreRef]);
}
