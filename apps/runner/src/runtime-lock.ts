import { parseAllDocuments } from "yaml";
import { z } from "zod";

const dependencies = z.record(z.string(), z.object({ version: z.string() }));
const lockSchema = z.object({
  importers: z.record(
    z.string(),
    z.object({
      dependencies: dependencies.optional(),
      devDependencies: dependencies.optional(),
    }),
  ),
  packages: z.record(z.string(), z.unknown()),
  snapshots: z.record(
    z.string(),
    z.object({
      dependencies: z.record(z.string(), z.string()).optional(),
      optionalDependencies: z.record(z.string(), z.string()).optional(),
    }),
  ),
});

export const runtimePackages = [
  "apps/runner",
  "packages/contracts",
  "packages/datasets",
  "packages/evaluation",
  "packages/providers",
];

/** Fingerprint only the benchmark runtime closure, so a web redesign cannot block resume. */
export function runtimeLockEntries(text: string): [string, unknown][] {
  const documents = parseAllDocuments(text);
  if (documents.some((document) => document.errors.length))
    throw new Error("Invalid dependency lock");
  const locks = documents.map((document) => lockSchema.safeParse(document.toJS()));
  const lock = locks.find((result) => result.success && result.data.importers["apps/runner"]);
  if (!lock?.success) throw new Error("Benchmark workspace is missing from dependency lock");
  const resolved = lock.data;
  const entries = new Map<string, unknown>();
  function visit(name: string, version: string) {
    if (version.startsWith("link:")) return;
    const key = `${name}@${version}`;
    if (entries.has(key)) return;
    const snapshot = resolved.snapshots[key];
    const metadata = resolved.packages[key.split("(")[0] ?? key];
    if (!snapshot || !metadata) throw new Error(`Incomplete runtime dependency lock: ${key}`);
    entries.set(key, { metadata, snapshot });
    for (const [dependency, resolved] of Object.entries({
      ...snapshot.dependencies,
      ...snapshot.optionalDependencies,
    }))
      visit(dependency, resolved);
  }
  for (const name of runtimePackages) {
    const importer = resolved.importers[name];
    if (!importer) throw new Error(`Missing runtime package: ${name}`);
    for (const [dependency, entry] of Object.entries(importer.dependencies ?? {}))
      visit(dependency, entry.version);
  }
  const tsx = resolved.importers["."]?.devDependencies?.tsx;
  if (!tsx) throw new Error("Missing CLI TypeScript runtime");
  visit("tsx", tsx.version);
  return [...entries].sort(([a], [b]) => a.localeCompare(b));
}
