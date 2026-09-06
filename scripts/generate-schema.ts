import { readFile, writeFile } from "node:fs/promises";
import { experimentJsonSchema } from "@llang-gap/contracts";

const schema = experimentJsonSchema();
const path = new URL("../experiments/schema.json", import.meta.url);
const content = `${JSON.stringify(schema, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if ((await readFile(path, "utf8")) !== content)
    throw new Error("Experiment JSON Schema is stale; run pnpm schema");
} else {
  await writeFile(path, content);
}
