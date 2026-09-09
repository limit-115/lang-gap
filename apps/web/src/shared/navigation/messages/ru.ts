import type { Dictionary } from "@/i18n/routing";
import type en from "./en";
export default {
  run: "Конструктор",
  navigation: "Навигация",
  becomeSponsor: "Поддержать проект",
  resources: "Ресурсы",
  sourceCode: "Исходный код",
  documentation: "Документация",
  menu: "Открыть меню навигации",
  leaderboard: "Модели",
  methodology: "Методика",
  releases: "Выпуски",
  language: "Сменить язык",
  toggleTheme: "Переключить тему",
  skip: "Перейти к содержимому",
  tagline: "Сравните точность LLM на разных языках.",
  footer:
    "Мы тестируем LLM на разных языках и открыто публикуем результаты. Нам ещё многое предстоит проверить. Вам уже есть что перепроверить.",
  attribution: "Сделано в <author>Limit 115</author>.",
  home: "Lang Gap — главная",
} as const satisfies Dictionary<typeof en>;
