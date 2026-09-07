import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { workspace } from "./files";

export function loadEnvironment(path = join(workspace, ".env")): void {
  try {
    loadEnvFile(path);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
}
