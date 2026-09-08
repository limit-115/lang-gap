import type { ProtocolAdapter } from "@llang-gap/contracts";
import { protocol, authorAdapter } from "./mmluprox-author";

// A distinct condition: reuse pinned task inputs without changing historical objects.
export const flexibleProtocol = {
  ...protocol,
  id: "mmluprox-lite-5shot-flexible-api-v1",
  version: 1,
  generation: { ...protocol.generation, maxGenTokens: null },
  adaptations: [
    ...protocol.adaptations.filter((entry) => !entry.startsWith("The 2048-token")),
    "Output cap is an explicit experiment input: a positive integer or null to omit the API parameter. Provider defaults and limits still apply; this is not the author 2048-token condition.",
  ],
} as const;

export const flexibleAdapter = {
  ...authorAdapter,
  definition: flexibleProtocol,
  tokenPolicy: { fixed: null, required: false },
  validateOutputTokens: () => {},
} satisfies ProtocolAdapter;
