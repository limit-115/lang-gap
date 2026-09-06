import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { runtimeLockEntries, runtimePackages } from "./runtime-lock";

export const workspace = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
export const hash = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");
export const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
export const jsonl = (values: readonly unknown[]): string =>
  `${values.map((v) => JSON.stringify(v)).join("\n")}\n`;
export const readJson = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, "utf8")) as unknown;

export async function atomicWrite(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(tmp, content, { flag: "wx", mode: 0o600 });
    await rename(tmp, path);
  } finally {
    await rm(tmp, { force: true });
  }
}

export async function implementationIdentity(root: string) {
  const files: string[] = [];
  async function walk(directory: string) {
    for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
      if (["node_modules", ".turbo", "reference"].includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(ts|json)$/.test(path) && !path.endsWith(".test.ts")) files.push(path);
    }
  }
  for (const directory of runtimePackages) {
    await walk(join(directory, "src"));
    files.push(join(directory, "package.json"));
  }
  const contents = await Promise.all(
    files.sort().map(async (path) => `${path}\0${hash(await readFile(join(root, path)))}`),
  );
  contents.push(json(runtimeLockEntries(await readFile(join(root, "pnpm-lock.yaml"), "utf8"))));
  let commit: string | null = null;
  let clean = false;
  try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    clean =
      execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim() === "";
  } catch {
    /* A fresh checkout without a first commit supports local smoke runs. */
  }
  return { sha256: hash(contents.join("\n")), commit, clean };
}
