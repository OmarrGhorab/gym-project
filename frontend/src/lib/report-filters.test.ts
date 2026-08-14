import { describe, expect, it } from "vitest";

import { buildReportTabParams, getQuickReportDateRange, normalizeReportDateRange } from "./report-filters";

describe("report filters", () => {
  it("normalizes an empty or partial range to an explicit range", () => {
    expect(normalizeReportDateRange({}, "2026-08-14")).toEqual({ from: "2026-08-14", to: "2026-08-14" });
    expect(normalizeReportDateRange({ from: "", to: "" }, "2026-08-14")).toEqual({
      from: "2026-08-14",
      to: "2026-08-14",
    });
    expect(normalizeReportDateRange({ from: "2026-08-01" }, "2026-08-14")).toEqual({
      from: "2026-08-01",
      to: "2026-08-01",
    });
  });

  it("builds inclusive seven and thirty day quick ranges", () => {
    expect(getQuickReportDateRange("2026-08-14", 7)).toEqual({ from: "2026-08-08", to: "2026-08-14" });
    expect(getQuickReportDateRange("2026-08-14", 30)).toEqual({ from: "2026-07-16", to: "2026-08-14" });
  });

  it("uses gym dates for calendar presets", () => {
    expect(getQuickReportDateRange("2026-08-14", "this_month")).toEqual({
      from: "2026-08-01",
      to: "2026-08-14",
    });
    expect(getQuickReportDateRange("2026-08-14", "last_month")).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
    });
    expect(getQuickReportDateRange("2026-08-14", "ytd")).toEqual({
      from: "2026-01-01",
      to: "2026-08-14",
    });
  });

  it("drops report-specific filters when switching tabs", () => {
    const current = new URLSearchParams(
      "type=classes_plans&from=2026-08-01&to=2026-08-14&status=low_sessions&search=protein&category=drinks&payment_method=cash&group_by=month",
    );

    expect(
      buildReportTabParams(current, "member_subscriptions", { from: "2026-08-01", to: "2026-08-14" }).toString(),
    ).toBe("type=member_subscriptions&from=2026-08-01&to=2026-08-14");
  });
});
