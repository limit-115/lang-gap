import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { datasetManifestSchema } from "@llang-gap/contracts";
import { mmpisaFixture, mmpisaCsv } from "@tests/mmpisa-fixtures";
import { decodeMmpisa } from "#src/adapters/mmpisa";
import { prepareDataset, sha256 } from "./index";

afterEach(() => vi.unstubAllGlobals());

it.each(["github", "huggingface"] as const)(
  "loads shared JSONL and language shards from %s without fetching unselected files",
  async (hosting) => {
    const root = await mkdtemp(join(tmpdir(), "llang-shared-source-"));
    const questions = decodeMmpisa(mmpisaCsv(), "human").questions;
    const shards = [
      questions.filter((q) => q.id === "q001"),
      questions.filter((q) => q.id === "q002" && q.language === "kk"),
      questions.filter((q) => q.id === "q002" && q.language === "ja"),
    ];
    const bodies = shards.map((rows) => rows.map((q) => JSON.stringify(q)).join("\n") + "\n");
    const manifest = datasetManifestSchema.parse({
      ...mmpisaFixture(),
      id: "shared-jsonl-fixture",
      hosting,
      adapter: { format: "normalized-jsonl" },
      files: shards.map((rows, index) => ({
        path: `shard-${index}.jsonl`,
        sha256: sha256(bodies[index]!),
        rows: rows.length,
        partitions: rows.map((q) => ({ language: q.language, split: q.split, rows: 1 })),
      })),
    });
    const base =
      hosting === "github"
        ? `https://raw.githubusercontent.com/fixtures/mmpisa/${manifest.revision}`
        : `https://huggingface.co/datasets/fixtures/mmpisa/resolve/${manifest.revision}`;
    const fetch = vi.fn(async (input: string) => {
      const index = bodies.findIndex((_, i) => input === `${base}/shard-${i}.jsonl`);
      if (index < 0) throw new Error(`Unexpected source request: ${input}`);
      return new Response(bodies[index]!);
    });
    vi.stubGlobal("fetch", fetch);
    try {
      const single = await prepareDataset({ manifest, cacheDir: root, languages: ["kk"] });
      expect(single.questions).toEqual(questions.filter((q) => q.language === "kk"));
      expect(fetch.mock.calls.map(([url]) => url)).toEqual([
        `${base}/shard-0.jsonl`,
        `${base}/shard-1.jsonl`,
      ]);
      const both = await prepareDataset({ manifest, cacheDir: root });
      expect(both.questions).toHaveLength(4);
      expect(fetch).toHaveBeenCalledTimes(3);
      expect(
        (await prepareDataset({ manifest, cacheDir: root, offline: true, languages: ["kk"] })).hash,
      ).toBe(single.hash);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
