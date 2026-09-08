import { describe, expect, it } from "vitest";
import { releaseBibtex } from "./citation";

describe("releaseBibtex", () => {
  it.each(["science-ja", "history-ar"])(
    "cites the selected %s release and its UTC creation year",
    (dataset) => {
      const bibtex = releaseBibtex(
        {
          id: "test-release",
          dataset,
          protocol: "test-v2",
          createdAt: "2026-01-01T00:30:00+01:00",
        },
        "https://example.org/en/releases/test-release/",
      );
      expect(bibtex).toContain(`title = {{Lang Gap: ${dataset}}}`);
      expect(bibtex).toContain("author = {{Limit 115}}");
      expect(bibtex).toContain("year = {2025}");
      expect(bibtex).toContain("Release test-release. Created 2025-12-31. Protocol: test-v2.");
      expect(bibtex).toContain("url = {https://example.org/en/releases/test-release/}");
    },
  );

  it("escapes TeX syntax in release metadata", () => {
    const bibtex = releaseBibtex(
      {
        id: "test",
        dataset: "A & B_{50%}",
        protocol: "test_v1",
        createdAt: "2026-09-08T00:00:00Z",
      },
      "https://example.org/en/releases/test/",
    );
    expect(bibtex).toContain("A \\& B\\_\\{50\\%\\}");
    expect(bibtex).toContain("test\\_v1");
  });
});
