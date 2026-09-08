import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { datasetManifestSchema } from "@llang-gap/contracts";
import { mmpisaCsv, mmpisaFixture, mmpisaRows } from "@tests/mmpisa-fixtures";
import { decodeMmpisa } from "#src/adapters/mmpisa";
import { prepareDataset, readManifest, sha256, validateAlignment } from "./index";

afterEach(() => vi.unstubAllGlobals());

describe("mmPISA normalization", () => {
  it.each(["human", "machine"] as const)(
    "preserves context, ordered choices and identities for %s",
    (variant) => {
      const decoded = decodeMmpisa(mmpisaCsv(), variant);
      expect(decoded.rowCount).toBe(8);
      expect(decoded.questions).toHaveLength(4);
      expect(decoded.questions[0]).toMatchObject({
        id: "q001",
        sourceId: "q001",
        language: "kk",
        split: "test",
        category: "Math",
        question: `Synthetic context, with a "quote".\nSecond line.\n\nSynthetic ${variant} Kazakh question 1?`,
        options: ["one", "two"],
        answer: "B",
        cot: "PRIVATE_TARGET_SOLUTION",
      });
      expect(decoded.questions[1]).toMatchObject({
        options: ['["yes","no"]', '["no","yes"]'],
        cot: "",
      });
      expect(() => validateAlignment(decoded.questions, "kk", "ja")).not.toThrow();
    },
  );

  it.each([
    { language_code: "kaz-KAZ wrong" },
    { language: "Unknown" },
    { answer_type: "open" },
    { gold: "J" },
    { context: "" },
    { question: "" },
    { qid: "" },
    { options: '["B) wrong", "A) order"]' },
    { options: '[{"B":["wrong"]}, {"A":["order"]}]' },
    { options: '[{"A":[1]}, {"B":["two"]}]' },
    { options: '[{"A":[]}, {"B":["two"]}]' },
    { options: '[{"A":["one"],"extra":["two"]}, {"B":["two"]}]' },
    { options: "not JSON" },
  ])("rejects malformed source data: %j", (change) => {
    expect(() => decodeMmpisa(mmpisaCsv([{ ...mmpisaRows[0]!, ...change }]), "human")).toThrow();
  });

  it("rejects malformed CSV, unexpected headers and duplicate variant/language/question identities", () => {
    expect(() => decodeMmpisa(mmpisaCsv().replace("qid,", "wrong,"), "human")).toThrow("header");
    expect(() => decodeMmpisa(mmpisaCsv().replace("qid,language,", "qid,qid,"), "human")).toThrow(
      "header",
    );
    expect(() => decodeMmpisa(mmpisaCsv() + '"unterminated', "human")).toThrow();
    expect(() => decodeMmpisa(mmpisaCsv([...mmpisaRows, mmpisaRows[0]!]), "human")).toThrow(
      "Duplicate",
    );
  });

  it.each([
    ["English Machine", "eng-CAN", "en"],
    ["French Machine", "fra-FRA", "fr"],
    ["Nynorsk Machine", "nno-NOR no", "nn"],
    ["Bokmål Machine", "nob-NOR nb", "nb"],
    ["Hebrew Machine", "heb-ISR iw", "he"],
    ["Georgian", "geo-GEO", "ka"],
    ["Slovak", "slo-SVK", "sk"],
    ["Spanish", "esp-ESP", "es"],
  ])("resolves upstream identity %s / %s as %s", (name, code, language) => {
    const csv = mmpisaCsv([{ ...mmpisaRows[0]!, language: name, language_code: code }]);
    expect(
      decodeMmpisa(csv, name.endsWith(" Machine") ? "machine" : "human").questions[0]!.language,
    ).toBe(language);
  });
});

describe("shared source manifests", () => {
  it("downloads a pinned source once, selects one language, verifies cache and enforces counts", async () => {
    const root = await mkdtemp(join(tmpdir(), "llang-mmpisa-"));
    const manifest = mmpisaFixture();
    const fetch = vi.fn(async () => new Response(mmpisaCsv()));
    vi.stubGlobal("fetch", fetch);
    try {
      const prepared = await prepareDataset({ manifest, cacheDir: root, languages: ["ja"] });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        `https://raw.githubusercontent.com/fixtures/mmpisa/${manifest.revision}/shared/questions.csv`,
        { signal: expect.any(AbortSignal) },
      );
      expect(prepared.questions.map((q) => q.language)).toEqual(["ja", "ja"]);
      const all = await prepareDataset({ manifest, cacheDir: root, offline: true });
      expect(all.questions).toHaveLength(4);
      const again = await prepareDataset({
        manifest,
        cacheDir: root,
        offline: true,
        languages: ["ja"],
      });
      expect(again.hash).toBe(prepared.hash);
      expect(all.hash).not.toBe(prepared.hash);
      expect(fetch).toHaveBeenCalledTimes(1);
      for (const languages of [[], ["ja", "ja"], ["uz"]])
        await expect(prepareDataset({ manifest, cacheDir: root, languages })).rejects.toThrow();
      const file = manifest.files[0]!;
      for (const changed of [
        { ...file, rows: 9 },
        { ...file, partitions: file.partitions.map((p) => ({ ...p, rows: 1 })) },
        { ...file, partitions: [{ language: "ja", split: "test" as const, rows: 2 }] },
      ])
        await expect(
          prepareDataset({
            manifest: { ...manifest, files: [changed] },
            cacheDir: root,
            offline: true,
          }),
        ).rejects.toThrow();
      const path = join(prepared.directory, file.path);
      expect(sha256(await readFile(path))).toBe(file.sha256);
      await writeFile(path, "corrupt");
      await expect(prepareDataset({ manifest, cacheDir: root, offline: true })).rejects.toThrow(
        "Corrupted",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects missing offline sources and corrupt downloads before writing a cache", async () => {
    const root = await mkdtemp(join(tmpdir(), "llang-mmpisa-"));
    const fetch = vi.fn(async () => new Response("corrupt"));
    vi.stubGlobal("fetch", fetch);
    try {
      const manifest = mmpisaFixture();
      await expect(prepareDataset({ manifest, cacheDir: root, offline: true })).rejects.toThrow(
        "not cached",
      );
      expect(fetch).not.toHaveBeenCalled();
      await expect(prepareDataset({ manifest, cacheDir: root })).rejects.toThrow("Checksum");
      await expect(prepareDataset({ manifest, cacheDir: root, offline: true })).rejects.toThrow(
        "not cached",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects ambiguous partition declarations, unsafe paths and unsupported adapters", () => {
    const manifest = mmpisaFixture();
    const file = manifest.files[0]!;
    for (const change of [
      { files: [file, file] },
      { files: [{ ...file, path: "../private" }] },
      { files: [{ ...file, partitions: [file.partitions[0], file.partitions[0]] }] },
      { files: [{ ...file, rows: 1 }] },
      { adapter: { format: "mmpisa-csv", translation: "mixed" } },
      { adapter: { format: "mmpisa-csv" } },
      { hosting: "arbitrary-url" },
    ])
      expect(datasetManifestSchema.safeParse({ ...manifest, ...change }).success).toBe(false);
  });

  it.each(["mmpisa", "mmpisa-machine"])(
    "registers %s with localized prompts for every declared partition",
    async (id) => {
      const manifest = await readManifest(
        new URL(`../../../datasets/${id}/manifest.json`, import.meta.url).pathname,
      );
      if (manifest.schemaVersion !== 3) throw new Error("Expected schema v3");
      expect(manifest.id).toBe(id);
      expect(manifest.adapter).toEqual({
        format: "mmpisa-csv",
        translation: id === "mmpisa" ? "human" : "machine",
      });
      expect(manifest.files).toHaveLength(1);
      expect(manifest.files[0]!.partitions).toHaveLength(43);
      expect(Object.keys(manifest.prompts).sort()).toEqual(
        manifest.files[0]!.partitions.map((p) => p.language).sort(),
      );
    },
  );
});
