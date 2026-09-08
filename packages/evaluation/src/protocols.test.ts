import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import type { ProtocolId } from "@llang-gap/contracts";
import { getProtocol, getMaxOutputTokens, validateOutputTokens, scoreAnswer } from "./index";
import { getProtocolAdapter } from "#src/protocols/index";

it.each([
  { id: "multiple-choice-v1", fixed: undefined, required: false, text: "A", refusal: true },
  {
    id: "mmluprox-lite-5shot-native-reasoning-v1",
    fixed: undefined,
    required: true,
    text: "The answer is (A)",
    refusal: false,
  },
  {
    id: "mmluprox-lite-5shot-author-api-v3",
    fixed: 2048,
    required: true,
    text: "The answer is (A)",
    refusal: true,
  },
  {
    id: "mmluprox-lite-5shot-flexible-api-v1",
    fixed: undefined,
    required: false,
    text: "The answer is (A)",
    refusal: true,
  },
] satisfies {
  id: ProtocolId;
  fixed: number | undefined;
  required: boolean;
  text: string;
  refusal: boolean;
}[])(
  "keeps $id token requirements and response handling distinct",
  ({ id, fixed, required, text, refusal }) => {
    expect(getMaxOutputTokens(id)).toBe(fixed);
    expect(getProtocolAdapter(id).tokenPolicy.required).toBe(required);
    for (const cap of [null, 2048, 4096]) {
      const validate = () => validateOutputTokens(id, cap);
      if ((required && cap === null) || (fixed !== undefined && cap !== fixed))
        expect(validate).toThrow();
      else expect(validate).not.toThrow();
    }
    expect(scoreAnswer(text, "en", "A", 2, "completed", id).correct).toBe(true);
    for (const outcome of ["refusal", "truncated"] as const)
      expect(scoreAnswer(text, "en", "A", 2, outcome, id).correct).toBe(refusal);
  },
);

it.each([
  {
    id: "multiple-choice-v1",
    hash: "72c89059d1feae7445c3c3ddfab53f6b13f41f0e3d4156735f27fb361d330cfe",
  },
  {
    id: "mmluprox-lite-5shot-flexible-api-v1",
    hash: "781b781a18741c091df84a716ffd6defe27f4944447df0e94c373980049e9c26",
  },
] satisfies { id: ProtocolId; hash: string }[])(
  "preserves the saved definition hash for $id",
  ({ id, hash }) => {
    expect(
      createHash("sha256")
        .update(`${JSON.stringify(getProtocol(id), null, 2)}\n`)
        .digest("hex"),
    ).toBe(hash);
  },
);
