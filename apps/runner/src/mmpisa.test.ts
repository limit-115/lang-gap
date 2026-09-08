import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, it, vi } from "vitest";
import { prepareDataset } from "@llang-gap/datasets";
import { buildPrompt, getPromptLabels, toPromptQuestion } from "@llang-gap/evaluation";
import { createFakeAdapter } from "@llang-gap/transports";
import { mmpisaCsv, mmpisaFixture } from "@tests/mmpisa-fixtures";
import { experiment } from "@tests/fixtures";
import { selectExperiment } from "./config";
import { createJobs } from "./plan";
import { createRun, resumeRun } from "./run";
import { buildRelease, verifyRelease } from "./release";

it.each(["human", "machine"] as const)(
  "runs mmPISA %s through selection, resume and verified releases",
  async (translation) => {
    const root = await mkdtemp(join(tmpdir(), "llang-mmpisa-run-"));
    try {
      const manifest = mmpisaFixture(translation);
      const source = join(
        root,
        manifest.id,
        manifest.revision,
        "normalizer-1",
        manifest.files[0]!.path,
      );
      await mkdir(dirname(source), { recursive: true });
      await writeFile(source, mmpisaCsv());
      const config = selectExperiment(experiment, {
        dataset: manifest.id,
        languages: ["kk", "ja"],
        compare: ["ja:kk"],
        protocol: "multiple-choice-v1",
      });
      const prepared = await prepareDataset({
        manifest,
        cacheDir: root,
        offline: true,
        languages: config.languages,
      });
      const fake = createFakeAdapter();
      const generate = vi.fn(fake.generate);
      const adapters = new Map([["fake", { ...fake, generate }]]);
      const directory = join(root, "paired");
      const run = await createRun({
        experiment: config,
        manifest,
        questions: prepared.questions,
        directory,
        adapters,
        maxJobs: 1,
      });
      expect(run.completed).toBe(1);
      await expect(buildRelease(directory, "incomplete", "test", root)).rejects.toThrow(
        "Incomplete",
      );
      const snapshot = await readFile(join(directory, "resolved.json"), "utf8");
      expect((await resumeRun(directory, { adapters })).completed).toBe(8);
      expect(generate).toHaveBeenCalledTimes(8);
      expect(await readFile(join(directory, "resolved.json"), "utf8")).toBe(snapshot);
      for (const [request] of generate.mock.calls) {
        expect(request.prompt).toContain(`Synthetic ${translation}`);
        expect(request.prompt).toContain('Synthetic context, with a "quote".\nSecond line.');
        expect(request.prompt).not.toContain("PRIVATE_TARGET_SOLUTION");
        expect(request.prompt).not.toContain("Synthetic source");
      }
      const target = prepared.questions[0]!;
      const prompt = (answer: string, cot: string) =>
        buildPrompt(
          toPromptQuestion({ ...target, answer, cot }),
          [],
          config.protocol,
          getPromptLabels(manifest, target.language),
        );
      expect(prompt("A", "SECRET_A")).toBe(prompt("B", "SECRET_B"));
      expect(() =>
        createJobs(
          { ...config, protocol: experiment.protocol },
          prepared.questions,
          "hash",
          manifest,
        ),
      ).toThrow("requires its recorded dataset");
      expect(() =>
        createJobs(config, prepared.questions, "hash", { ...manifest, prompts: {} }),
      ).toThrow("localized prompt");
      const release = await buildRelease(directory, "paired-release", "test", root);
      const verified = await verifyRelease(release.directory);
      expect(verified.dataset).toBe(manifest.id);
      expect(verified.aggregate[0]).toMatchObject({
        scores: [
          { language: "kk", n: 2 },
          { language: "ja", n: 2 },
        ],
        comparisons: [{ baseline: "ja", language: "kk" }],
      });
      expect(
        JSON.parse(await readFile(join(release.directory, "dataset-manifest.json"), "utf8")),
      ).toEqual(manifest);

      const singleConfig = selectExperiment(config, { language: "ja" });
      const selected = await prepareDataset({
        manifest,
        cacheDir: root,
        offline: true,
        languages: singleConfig.languages,
      });
      const single = await createRun({
        experiment: singleConfig,
        manifest,
        questions: selected.questions,
        directory: join(root, "single"),
        adapters,
      });
      expect(single.completed).toBe(4);
      const singleRelease = await buildRelease(single.directory, "single-release", "test", root);
      expect((await verifyRelease(singleRelease.directory)).aggregate[0]).toMatchObject({
        scores: [{ language: "ja", n: 2 }],
        comparisons: [],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
