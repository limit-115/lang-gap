import modelsEn from "@/features/models/messages/en";
import languagesEn from "@/features/languages/messages/en";
import languagesRu from "@/features/languages/messages/ru";
import modelsRu from "@/features/models/messages/ru";
import runBuilderEn from "@/features/run-builder/messages/en";
import runBuilderRu from "@/features/run-builder/messages/ru";
import navigationEn from "@/shared/navigation/messages/en";
import navigationRu from "@/shared/navigation/messages/ru";
import leaderboardEn from "@/features/leaderboard/messages/en";
import leaderboardRu from "@/features/leaderboard/messages/ru";
import methodologyEn from "@/features/methodology/messages/en";
import methodologyRu from "@/features/methodology/messages/ru";
import releasesEn from "@/features/releases/messages/en";
import releasesRu from "@/features/releases/messages/ru";
import notFoundEn from "@/features/not-found/messages/en";
import notFoundRu from "@/features/not-found/messages/ru";
import type { Locale } from "./routing";

export const englishMessages = {
  Languages: languagesEn,
  Models: modelsEn,
  RunBuilder: runBuilderEn,
  Navigation: navigationEn,
  Leaderboard: leaderboardEn,
  Methodology: methodologyEn,
  Releases: releasesEn,
  NotFound: notFoundEn,
};
const russianMessages = {
  Languages: languagesRu,
  Models: modelsRu,
  RunBuilder: runBuilderRu,
  Navigation: navigationRu,
  Leaderboard: leaderboardRu,
  Methodology: methodologyRu,
  Releases: releasesRu,
  NotFound: notFoundRu,
};
export function getMessagesForLocale(locale: Locale) {
  return locale === "en" ? englishMessages : russianMessages;
}
