import { describe, expect, it } from "vitest";

import { dedupeLatestSubscriptions } from "./data";

type Row = Parameters<typeof dedupeLatestSubscriptions>[0][number];

function subscription(id: number, status: string, endDate: string, memberId = 13): Row {
  return {
    id,
    status,
    end_date: endDate,
    member: { id: memberId, name: `Member #${memberId}` },
  } as Row;
}

describe("dedupeLatestSubscriptions", () => {
  it("prefers a scheduled subscription over the member's cancelled one", () => {
    // The real case: staff cancelled #42 and immediately sold #43 starting next
    // week. Ranking scheduled below stopped left the pipeline showing #42.
    const rows = dedupeLatestSubscriptions([
      subscription(42, "stopped", "2026-08-12"),
      subscription(43, "scheduled", "2027-02-15"),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(43);
  });

  it("keeps the period that runs latest when a member has both a running and a scheduled membership", () => {
    const rows = dedupeLatestSubscriptions([
      subscription(50, "active", "2026-09-10"),
      subscription(51, "scheduled", "2026-10-10"),
    ]);

    expect(rows[0].id).toBe(51);
  });

  it("still drops finished periods in favour of a running one", () => {
    const rows = dedupeLatestSubscriptions([
      subscription(60, "expired", "2026-07-01"),
      subscription(61, "active", "2026-09-01"),
    ]);

    expect(rows[0].id).toBe(61);
  });

  it("keeps one row per member", () => {
    const rows = dedupeLatestSubscriptions([
      subscription(70, "stopped", "2026-08-12", 1),
      subscription(71, "scheduled", "2026-12-01", 1),
      subscription(72, "active", "2026-09-01", 2),
    ]);

    expect(rows.map((row) => row.id).sort()).toEqual([71, 72]);
  });
});
