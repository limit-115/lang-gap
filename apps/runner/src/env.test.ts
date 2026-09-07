import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createAdapter } from "@llang-gap/providers";
import { loadEnvironment } from "./env";

let directory: string;
let path: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "llang-env-"));
  path = join(directory, ".env");
  for (const key of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY"])
    vi.stubEnv(key, undefined);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

it("loads provider keys from a dotenv file before adapter creation", async () => {
  await writeFile(
    path,
    "# Synthetic credentials only\nOPENAI_API_KEY=\"fixture-openai\"\nANTHROPIC_API_KEY=fixture-anthropic\nexport OPENROUTER_API_KEY='fixture-router' # inline comment\n",
  );
  loadEnvironment(path);
  expect(process.env.OPENAI_API_KEY).toBe("fixture-openai");
  expect(process.env.ANTHROPIC_API_KEY).toBe("fixture-anthropic");
  expect(process.env.OPENROUTER_API_KEY).toBe("fixture-router");
  expect(createAdapter("openrouter", 1000).transport).toBe("openrouter");
});

it.each(["fixture-shell", ""])("preserves an existing environment value %j", async (value) => {
  vi.stubEnv("OPENROUTER_API_KEY", value);
  await writeFile(path, "OPENROUTER_API_KEY=fixture-dotenv\n");
  loadEnvironment(path);
  expect(process.env.OPENROUTER_API_KEY).toBe(value);
});

it("allows a missing dotenv file for shell credentials and fake runs", () => {
  vi.stubEnv("OPENROUTER_API_KEY", "fixture-shell");
  expect(() => loadEnvironment(path)).not.toThrow();
  expect(process.env.OPENROUTER_API_KEY).toBe("fixture-shell");
  expect(createAdapter("fake", 1000).transport).toBe("fake");
});

it("does not hide dotenv read errors other than a missing file", () => {
  expect(() => loadEnvironment(directory)).toThrow();
});
