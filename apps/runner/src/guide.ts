import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { releaseManifestSchema, safeIdSchema } from "@llang-gap/contracts";
import {
  guideModelIdentity,
  guideProfileKey,
  guideIndexSchema,
  guidePlanSchema,
  guideSnapshotSchema,
  releaseEvidenceSchema,
  type PublishedGuidePlan,
} from "@llang-gap/contracts/guide";
import { buildGuide, reconcileGuidePlan } from "@llang-gap/evaluation/guide";
import { atomicWrite, hash, json, readJson, workspace } from "./files";
import { acquireLock } from "./state";
import { createReleaseEvidence } from "./release-evidence";

async function optionalJson(path: string) {
  try {
    return await readJson(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function stageGuideEvidence(directory: string, root = join(workspace, "results")) {
  const evidence = await createReleaseEvidence(directory);
  const target = join(root, evidence.releaseId);
  if (
    !Buffer.from(await readFile(join(directory, "manifest.json"))).equals(
      await readFile(join(target, "manifest.json")),
    )
  )
    throw new Error("Evidence must match an already staged public release");
  const content = json(evidence);
  const path = join(target, "evidence.json");
  const existing = await optionalJson(path);
  if (existing !== null) {
    if (json(existing) !== content) throw new Error("Existing evidence cannot be replaced");
  } else await writeFile(path, content, { flag: "wx" });
  return { id: evidence.releaseId, path };
}

export async function readGuideInputs(
  plan: PublishedGuidePlan,
  root: string,
  requirePublished = true,
) {
  const index = requirePublished
    ? ((await readJson(join(root, "index.json"))) as { releases: string[] })
    : null;
  return Promise.all(
    plan.releases.map(async (id) => {
      if (index && !index.releases.includes(id)) throw new Error(`Unpublished release: ${id}`);
      const directory = join(root, id);
      const raw = await readFile(join(directory, "manifest.json"));
      const manifest = releaseManifestSchema.parse(JSON.parse(raw.toString("utf8")));
      if (manifest.id !== id) throw new Error("Release ID mismatch");
      const aggregate = await readFile(join(directory, "aggregate.json"));
      if (
        hash(aggregate) !== manifest.files["aggregate.json"] ||
        JSON.stringify(JSON.parse(aggregate.toString("utf8"))) !==
          JSON.stringify(manifest.aggregate)
      )
        throw new Error(`Invalid published aggregate: ${id}`);
      const evidenceValue = await optionalJson(join(directory, "evidence.json"));
      const evidence = evidenceValue === null ? null : releaseEvidenceSchema.parse(evidenceValue);
      return {
        manifest,
        manifestHash: hash(raw),
        evidence,
        evidenceHash:
          evidence === null ? null : hash(await readFile(join(directory, "evidence.json"))),
      };
    }),
  );
}

export async function publishGuide(
  planPath: string,
  id: string,
  root = join(workspace, "results"),
) {
  safeIdSchema.parse(id);
  return publishGuidePlan(guidePlanSchema.parse(await readJson(planPath)), id, root);
}

async function publishGuidePlan(plan: PublishedGuidePlan, id: string, root: string) {
  safeIdSchema.parse(id);
  const snapshot = buildGuide(
    plan,
    await readGuideInputs(plan, root),
    id,
    new Date().toISOString(),
  );
  const directory = join(root, "guide");
  await mkdir(directory, { recursive: true });
  const unlock = await acquireLock(directory);
  const temporary = join(directory, `.tmp-${randomUUID()}`);
  const target = join(directory, id);
  try {
    const index = guideIndexSchema.parse(
      (await optionalJson(join(directory, "index.json"))) ?? {
        schemaVersion: 1,
        latest: null,
        snapshots: [],
      },
    );
    const earlier = await Promise.all(
      index.snapshots.map(async (entry) => {
        const content = await readFile(join(directory, entry.id, "summary.json"));
        if (hash(content) !== entry.sha256) throw new Error("Previous guide checksum mismatch");
        return guideSnapshotSchema.parse(JSON.parse(content.toString("utf8")));
      }),
    );
    for (const previous of earlier) {
      if (previous.plan.schemaVersion !== 1 || plan.schemaVersion !== 1) continue;
      if (
        previous.plan.suite.id === plan.suite.id &&
        (json(previous.plan.suite) !== json(plan.suite) ||
          previous.plan.configurationRows !== plan.configurationRows)
      )
        throw new Error("A changed suite requires a new suite ID");
      if (
        previous.plan.suite.id === plan.suite.id &&
        previous.plan.profiles.some((profile) => {
          const replacement = plan.profiles.find((entry) =>
            plan.configurationRows
              ? guideProfileKey(entry) === guideProfileKey(profile)
              : guideModelIdentity(entry).id === guideModelIdentity(profile).id,
          );
          return !replacement || JSON.stringify(replacement) !== JSON.stringify(profile);
        })
      )
        throw new Error("A changed model profile requires a new suite ID");
    }
    if (index.snapshots.some((entry) => entry.id === id))
      throw new Error("Guide snapshot already exists");
    const content = json(snapshot);
    await mkdir(temporary);
    await writeFile(join(temporary, "summary.json"), content, { flag: "wx" });
    await mkdir(target); // Exclusive reservation; never replace a previous snapshot.
    try {
      await rename(join(temporary, "summary.json"), join(target, "summary.json"));
      await atomicWrite(
        join(directory, "index.json"),
        json({
          schemaVersion: 1,
          latest: id,
          snapshots: [...index.snapshots, { id, sha256: hash(content) }],
        }),
      );
    } catch (error) {
      await rm(target, { recursive: true, force: true });
      throw error;
    }
    return { id, models: snapshot.models.length, directory: target };
  } finally {
    await rm(temporary, { recursive: true, force: true });
    await unlock();
  }
}

export async function verifyGuide(id: string, root = join(workspace, "results")) {
  safeIdSchema.parse(id);
  const index = guideIndexSchema.parse(await readJson(join(root, "guide/index.json")));
  const entry = index.snapshots.find((value) => value.id === id);
  if (!entry) throw new Error("Unpublished guide snapshot");
  const content = await readFile(join(root, "guide", id, "summary.json"));
  if (hash(content) !== entry.sha256) throw new Error("Guide checksum mismatch");
  const snapshot = guideSnapshotSchema.parse(JSON.parse(content.toString("utf8")));
  if (snapshot.id !== id) throw new Error("Guide ID mismatch");
  const rebuilt = buildGuide(
    snapshot.plan,
    await readGuideInputs(snapshot.plan, root, false),
    id,
    snapshot.createdAt,
  );
  if (json(rebuilt) !== json(snapshot))
    throw new Error("Guide scores or provenance do not reproduce");
  return { valid: true, id, models: snapshot.models.length };
}

export async function verifyAllGuides(root = join(workspace, "results")) {
  const index = guideIndexSchema.parse(await readJson(join(root, "guide/index.json")));
  return Promise.all(index.snapshots.map((entry) => verifyGuide(entry.id, root)));
}

async function publicationPlan(root: string) {
  const plan = guidePlanSchema.parse(await readJson(join(root, "guide-plan.json")));
  const index = (await readJson(join(root, "index.json"))) as { releases: string[] };
  return reconcileGuidePlan(
    plan,
    await readGuideInputs({ ...plan, releases: index.releases }, root),
  );
}

/** Publish a resolved, immutable snapshot from the staged inventory. Safe to retry. */
export async function syncGuide(root = join(workspace, "results")) {
  const unlock = await acquireLock(root);
  try {
    return await syncGuideUnlocked(root);
  } finally {
    await unlock();
  }
}

async function syncGuideUnlocked(root: string) {
  const plan = await publicationPlan(root);
  const index = guideIndexSchema.parse(
    (await optionalJson(join(root, "guide/index.json"))) ?? {
      schemaVersion: 1,
      latest: null,
      snapshots: [],
    },
  );
  if (index.latest) {
    await verifyGuide(index.latest, root);
    const current = guideSnapshotSchema.parse(
      await readJson(join(root, "guide", index.latest, "summary.json")),
    );
    if (json(current.plan) === json(plan)) {
      await atomicWrite(join(root, "guide-plan.json"), json(plan));
      return { id: current.id, changed: false };
    }
  }
  const id = `published-${hash(json(plan)).slice(0, 20)}-${randomUUID().slice(0, 8)}`;
  const published = await publishGuidePlan(plan, id, root);
  await atomicWrite(join(root, "guide-plan.json"), json(plan));
  return { ...published, changed: true };
}

export async function verifyGuidePublication(root = join(workspace, "results")) {
  const plan = await publicationPlan(root);
  const index = guideIndexSchema.parse(await readJson(join(root, "guide/index.json")));
  if (!index.latest) throw new Error("Missing published guide; run bench guide sync");
  await verifyGuide(index.latest, root);
  const snapshot = guideSnapshotSchema.parse(
    await readJson(join(root, "guide", index.latest, "summary.json")),
  );
  if (json(snapshot.plan) !== json(plan))
    throw new Error("Homepage guide is stale relative to staged releases; run bench guide sync");
  return { valid: true, id: index.latest };
}
