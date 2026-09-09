import { describe, expect, it } from "vitest";
import { releaseSubmissionsSchema } from "./index";

const fixture = (submitter: Record<string, string>) => ({
  schemaVersion: 1,
  releases: { "synthetic-report": submitter },
});

describe("release submission metadata", () => {
  it("accepts a full name independently of the GitHub username", () => {
    const input = fixture({ githubUsername: "fixture-author", fullName: "José Example" });
    expect(releaseSubmissionsSchema.parse(input)).toEqual(input);
  });

  it.each(["../another-profile", "name?tab=repositories", "@fixture-author", ""])(
    "rejects invalid profile identifiers: %s",
    (githubUsername) => {
      expect(
        releaseSubmissionsSchema.safeParse(fixture({ githubUsername, fullName: "Example Author" }))
          .success,
      ).toBe(false);
    },
  );

  it("requires the confirmed full name instead of silently falling back to a handle", () => {
    expect(
      releaseSubmissionsSchema.safeParse(
        fixture({ githubUsername: "fixture-author", fullName: "   " }),
      ).success,
    ).toBe(false);
    expect(
      releaseSubmissionsSchema.safeParse(fixture({ githubUsername: "fixture-author" })).success,
    ).toBe(false);
  });
});
