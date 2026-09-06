import { z } from "zod";
import { datasetManifestSchema, experimentSchema, hashSchema } from "@llang-gap/contracts";
import { protocol } from "@llang-gap/evaluation";
import { hash, json, readJson } from "./files";
import { join } from "node:path";

export const snapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  runId: z.string(),
  createdAt: z.iso.datetime(),
  experiment: experimentSchema,
  datasetManifest: datasetManifestSchema,
  datasetHash: hashSchema,
  protocolHash: hashSchema,
  protocol: z.unknown(),
  implementation: z.strictObject({
    sha256: hashSchema,
    commit: z.string().nullable(),
    clean: z.boolean(),
  }),
  node: z.string(),
  initialBudgetUsd: z.number().nonnegative(),
  providerMetadata: z.array(
    z.strictObject({ provider: z.string(), sdkVersion: z.string(), endpoint: z.string() }),
  ),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

export async function readSnapshot(
  directory: string,
): Promise<{ snapshot: Snapshot; configHash: string }> {
  const raw = await readJson(join(directory, "resolved.json"));
  const snapshot = snapshotSchema.parse(raw);
  const configHash = hash(json(raw));
  const expected = await readJson(join(directory, "identity.json"));
  if (z.strictObject({ configHash: hashSchema }).parse(expected).configHash !== configHash)
    throw new Error("Resolved configuration was modified");
  if (
    snapshot.protocolHash !== hash(json(protocol)) ||
    hash(json(snapshot.protocol)) !== snapshot.protocolHash
  )
    throw new Error("Protocol implementation differs from this run");
  return { snapshot, configHash };
}
