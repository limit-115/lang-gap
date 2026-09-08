import { z } from "zod";
import { languageSchema, protocolIdSchema, safeIdSchema } from "./index";

// Public setup metadata only. No question text, answers, credentials, or run state.
export const runDatasetSchema = z.strictObject({
  id: safeIdSchema,
  languages: z.array(
    z.strictObject({ tag: languageSchema, questions: z.number().int().positive() }),
  ),
  protocols: z.array(
    z.strictObject({
      id: protocolIdSchema,
      languages: z.array(languageSchema),
      tokenCap: z.number().int().positive().nullable(),
      requiresTokenCap: z.boolean(),
    }),
  ),
});
export type RunDataset = z.infer<typeof runDatasetSchema>;
