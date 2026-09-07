import type { Dictionary } from "@/i18n/routing";
import type en from "./en";
export default {
  navigation: "Навигация",
  becomeSponsor: "Стать спонсором",
  resources: "Ресурсы",
  sourceCode: "Исходный код",
  documentation: "Документация",
  menu: "Открыть меню навигации",
  leaderboard: "Сравнить модели",
  methodology: "Как мы тестируем",
  releases: "История выпусков",
  language: "Сменить язык",
  toggleTheme: "Переключить тему",
  skip: "Перейти к содержимому",
  tagline: "Сравните точность LLM на разных языках.",
  footer:
    "Сравнивайте точность LLM на разных языках и проверяйте данные, на которых основана каждая опубликованная оценка.",
  attribution: "Проект <author>Limit 115</author>.",
  home: "Llang Gap — главная",
} as const satisfies Dictionary<typeof en>;
