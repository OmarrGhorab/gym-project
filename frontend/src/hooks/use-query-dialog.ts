"use client";

import * as React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Dialog state that can also be opened from the URL, e.g. `?action=record-expense`.
 *
 * The dashboard quick shortcuts rely on this: a shortcut links to the page that owns
 * the modal and the modal opens itself on arrival. Closing it strips the param again so
 * a refresh or a back/forward step does not re-open the modal.
 */
export function useQueryDialog(action: string, key = "action") {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get(key) === action;
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (requested) {
      setOpen(true);
    }
  }, [requested]);

  const clear = React.useCallback(() => {
    if (!requested) {
      return;
    }

    const params = new URLSearchParams(searchParams);
    params.delete(key);
    const nextUrl = params.size ? `${pathname}?${params.toString()}` : pathname;

    router.replace(nextUrl, { scroll: false });
  }, [key, pathname, requested, router, searchParams]);

  const onOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);

      if (!nextOpen) {
        clear();
      }
    },
    [clear],
  );

  return { clear, onOpenChange, open, requested, setOpen };
}
