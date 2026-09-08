import { z } from "zod";
import { languageSchema, protocolIdSchema, safeIdSchema } from "./index";

export const datasetProtocolsSchema = z
  .strictObject({
    recommendedProtocol: protocolIdSchema,
    protocols: z.array(protocolIdSchema).min(1),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.protocols).size !== value.protocols.length)
      ctx.addIssue({ code: "custom", path: ["protocols"], message: "Duplicate protocol" });
    if (!value.protocols.includes(value.recommendedProtocol))
      ctx.addIssue({
        code: "custom",
        path: ["recommendedProtocol"],
        message: "Recommended protocol must be available",
      });
  });
export type DatasetProtocols = z.infer<typeof datasetProtocolsSchema>;

// Public setup metadata only. No question text, answers, credentials, or run state.
export const runDatasetSchema = z.strictObject({
  id: safeIdSchema,
  recommendedProtocol: protocolIdSchema,
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
