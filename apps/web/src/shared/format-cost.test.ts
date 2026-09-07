import { describe, expect, it } from "vitest";
import { formatCostUsd } from "./format-cost";

describe("USD task cost", () => {
  it("distinguishes free tasks from small positive costs", () => {
    expect(formatCostUsd(0, "en")).toBe("$0.0000");
    expect(formatCostUsd(0.012345, "en")).toBe("$0.012345");
    expect(formatCostUsd(0.000002, "en")).toBe("$0.000002");
    expect(formatCostUsd(0.0000002, "en")).toBe("<$0.000001");
    expect(formatCostUsd(0.012345, "ru")).toContain("0,012345");
  });
});
