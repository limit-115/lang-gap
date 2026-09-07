import { Ajv2020 } from "ajv/dist/2020.js";
import { expect, it } from "vitest";
import { experimentJsonSchema, experimentSchema } from "./index";
import { experiment } from "@tests/fixtures";

// Date/URI formats are outside this transport/model regression matrix.
const validate = new Ajv2020({ validateFormats: false }).compile(experimentJsonSchema());

it.each([
  ["openai", "gpt-6-astra", true],
  ["anthropic", "claude-fable-5-1", true],
  ["fake", "fake-v1", true],
  ["openrouter", "openai/gpt-5-nano", true],
  ["openrouter", "anthropic/claude-fable-5-1", true],
  ["openai", "openai/gpt-6-astra", false],
  ["anthropic", "anthropic/claude-fable-5-1", false],
  ["fake", "fake/fake-v1", false],
  ["openrouter", "gpt-5-nano", false],
  ["openrouter", "openrouter/auto", false],
  ["openrouter", "openai/gpt-5-nano:online", false],
  ["openrouter", "../secret", false],
  ["other", "openai/gpt-5-nano", false],
])("runtime and editor agree on %s / %s", (transport, model, accepted) => {
  const config = {
    ...experiment,
    models: [{ ...experiment.models[0]!, transport, model }],
  };
  expect(experimentSchema.safeParse(config).success).toBe(accepted);
  expect(validate(config)).toBe(accepted);
});

it("allows omitted comparison presets in runtime and editor schemas", () => {
  const { comparisons: _comparisons, ...config } = experiment;
  expect(experimentSchema.parse(config).comparisons).toEqual([]);
  expect(validate(config)).toBe(true);
});

it.each([null, 2048, 0, -1, "unlimited"])(
  "runtime and editor agree on explicit token cap %j",
  (cap) => {
    const config = {
      ...experiment,
      protocol: "mmluprox-lite-5shot-flexible-api-v1",
      models: experiment.models.map((model) => ({ ...model, maxOutputTokens: cap })),
    };
    const accepted = cap === null || cap === 2048;
    expect(experimentSchema.safeParse(config).success).toBe(accepted);
    expect(validate(config)).toBe(accepted);
  },
);
