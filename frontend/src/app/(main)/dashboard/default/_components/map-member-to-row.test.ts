import { describe, expect, it } from "vitest";

import { mapMemberToRow } from "./data";

type Member = Parameters<typeof mapMemberToRow>[0];

function member(latestSubscription: NonNullable<Member["latest_subscription"]>): Member {
  return {
    id: 3979,
    name: "فرح الشريف",
    status: "active",
    latest_subscription: latestSubscription,
  } as Member;
}

describe("mapMemberToRow", () => {
  it("carries the assigned coach onto the row", () => {
    // The real case: the membership stored coach #4, but this mapper dropped
    // coach_id, so the correction dialog opened on "no coach" and saving any
    // other field posted coach_id: null and unassigned the coach.
    const row = mapMemberToRow(
      member({
        id: 45,
        plan_id: 38,
        plan_name: "علاج طبيعي سيدات 10",
        coach_id: 4,
        coach: { id: 4, name: "Dr/Mohamed Abo zaid", role: "coach" },
        status: "active",
      }),
      null,
    );

    expect(row.latest_subscription?.coach_id).toBe(4);
    expect(row.latest_subscription?.coach).toEqual({ id: 4, name: "Dr/Mohamed Abo zaid", role: "coach" });
  });

  it("leaves an uncoached membership with no coach", () => {
    const row = mapMemberToRow(member({ id: 45, plan_id: 38, plan_name: "Gold", status: "active" }), null);

    expect(row.latest_subscription?.coach_id).toBeNull();
    expect(row.latest_subscription?.coach).toBeNull();
  });
});
