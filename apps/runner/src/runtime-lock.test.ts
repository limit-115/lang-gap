import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { runtimeLockEntries } from "./runtime-lock";
import { workspace } from "./files";
import { join } from "node:path";

describe("runtime dependency isolation", () => {
  it("ignores unrelated website dependencies but records runtime integrity", async () => {
    const text = await readFile(join(workspace, "pnpm-lock.yaml"), "utf8");
    const entries = runtimeLockEntries(text);
    expect(entries.some(([key]) => key.startsWith("openai@"))).toBe(true);
    expect(entries.some(([key]) => key.startsWith("next@"))).toBe(false);
    expect(entries.some(([key]) => key.startsWith("tsx@"))).toBe(true);
    expect(runtimeLockEntries(text.replaceAll("next@16.3.4", "next@16.3.5"))).toEqual(entries);
    expect(() =>
      runtimeLockEntries(text.replace("hyparquet@1.29.1:", "hyparquet@missing:")),
    ).toThrow("Incomplete");
  });
});
