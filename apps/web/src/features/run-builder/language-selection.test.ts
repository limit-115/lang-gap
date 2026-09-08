import { expect, it } from "vitest";
import type { RunDataset } from "@llang-gap/contracts/run-catalog";
import { getLanguageChoices, getQuestionRange } from "./language-selection";

const dataset: RunDataset = {
  id: "science",
  recommendedProtocol: "multiple-choice-v1",
  languages: [
    { tag: "de", questions: 7 },
    { tag: "ja", questions: 3 },
    { tag: "pt", questions: 7 },
  ],
  protocols: [
    {
      id: "multiple-choice-v1",
      languages: ["de", "ja", "fr"],
      tokenCap: null,
      requiresTokenCap: false,
    },
  ],
};

it("selects all actual dataset languages supported by the protocol, including a single-language selection", () => {
  const choices = getLanguageChoices(dataset, "multiple-choice-v1", ["ja"]);
  expect(choices).toEqual({ tags: ["de", "ja"], allSelected: false });
  expect(getLanguageChoices(dataset, "multiple-choice-v1", choices.tags).allSelected).toBe(true);
  expect(getLanguageChoices(dataset, "multiple-choice-v1", []).allSelected).toBe(false);
});

it("recomputes choices for another dataset and offers none before a compatible protocol exists", () => {
  const history: RunDataset = {
    ...dataset,
    id: "history",
    languages: [{ tag: "fr", questions: 12 }],
  };
  expect(getLanguageChoices(history, "multiple-choice-v1", ["de", "ja"])).toEqual({
    tags: ["fr"],
    allSelected: false,
  });
  expect(getLanguageChoices(history, "multiple-choice-v1", ["fr"]).allSelected).toBe(true);
  expect(getLanguageChoices(undefined, "", []).tags).toEqual([]);
  expect(getLanguageChoices(history, "", []).allSelected).toBe(false);
});

it("summarizes equal question counts once and preserves unequal split sizes", () => {
  expect(getQuestionRange(dataset.languages)).toEqual({ min: 3, max: 7 });
  expect(
    getQuestionRange([
      { tag: "zh-Hant", questions: 12 },
      { tag: "es", questions: 12 },
    ]),
  ).toEqual({ min: 12, max: 12 });
  expect(getQuestionRange([])).toBeNull();
});
