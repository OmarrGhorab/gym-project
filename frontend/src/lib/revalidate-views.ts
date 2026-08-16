import { revalidatePath } from "next/cache";

/**
 * The dashboard pages that read membership and money data.
 *
 * Kept in one place because every mutation has to invalidate all of them, and
 * listing them by hand at each call site is how the Overview went stale: selling
 * a membership revalidated members, memberships and finance but not the page the
 * owner actually looks at. A missing path here is invisible until somebody
 * notices a stale figure, so the list is the thing to keep correct — not the
 * dozen places that used to repeat it.
 */
const MEMBERSHIP_VIEWS = [
  "/dashboard",
  "/dashboard/default",
  "/dashboard/crm",
  "/dashboard/members",
  "/dashboard/finance",
  "/dashboard/daily-report",
  "/dashboard/reports",
] as const;

/** Anything that sells, renews, freezes, cancels or edits a membership. */
export function revalidateMembershipViews() {
  for (const path of MEMBERSHIP_VIEWS) {
    revalidatePath(path);
  }
}
