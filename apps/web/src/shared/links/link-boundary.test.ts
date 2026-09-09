import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { expect, it } from "vitest";

it("keeps raw anchors inside the shared link boundary", () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const violations = readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter(
      (path) =>
        path.endsWith(".tsx") && !path.endsWith(".test.tsx") && path !== "shared/links/link.tsx",
    )
    .filter((path) => /<a(?:\s|>)/.test(readFileSync(join(root, path), "utf8")));
  expect(
    violations,
    "Use a shared link component so indicators and interaction states stay consistent.",
  ).toEqual([]);
});
