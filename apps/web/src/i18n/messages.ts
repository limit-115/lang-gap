import navigationEn from "@/shared/navigation/messages/en";
import navigationRu from "@/shared/navigation/messages/ru";
import leaderboardEn from "@/features/leaderboard/messages/en";
import leaderboardRu from "@/features/leaderboard/messages/ru";
import methodologyEn from "@/features/methodology/messages/en";
import methodologyRu from "@/features/methodology/messages/ru";
import releasesEn from "@/features/releases/messages/en";
import releasesRu from "@/features/releases/messages/ru";
import type { Locale } from "./routing";

export const englishMessages = {
  Navigation: navigationEn,
  Leaderboard: leaderboardEn,
  Methodology: methodologyEn,
  Releases: releasesEn,
};
const russianMessages = {
  Navigation: navigationRu,
  Leaderboard: leaderboardRu,
  Methodology: methodologyRu,
  Releases: releasesRu,
};
export function getMessagesForLocale(locale: Locale) {
  return locale === "en" ? englishMessages : russianMessages;
}
