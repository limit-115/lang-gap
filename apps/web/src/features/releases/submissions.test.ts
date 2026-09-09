import { describe, expect, it, vi } from "vitest";
import { getReleaseSubmitters } from "./submissions";

vi.mock("@results/submissions.json", () => ({
  default: {
    schemaVersion: 1,
    releases: {
      "published-report": { githubUsername: "fixture-author", fullName: "José Example" },
      "unpublished-report": { githubUsername: "another-author", fullName: "Another Example" },
    },
  },
}));

describe("release submitter attribution", () => {
  it("includes confirmed full names only for the requested published reports", () => {
    expect(
      getReleaseSubmitters([{ id: "published-report" }, { id: "missing-attribution" }]),
    ).toEqual({
      "published-report": { githubUsername: "fixture-author", fullName: "José Example" },
    });
  });

  it("does not turn attribution metadata into published reports", () => {
    expect(getReleaseSubmitters([])).toEqual({});
  });
});
