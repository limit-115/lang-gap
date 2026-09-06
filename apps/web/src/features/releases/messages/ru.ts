import type { Dictionary } from "@/i18n/routing";
import type en from "./en";
export default {
  title: "Сохраняем историю.",
  intro: "Версии результатов, происхождение данных и никаких незаметных замен.",
  emptyTitle: "Опубликованных выпусков пока нет.",
  emptyBody: "Первый выпуск появится здесь после завершения оценки и независимой проверки.",
  back: "Все выпуски",
  download: "Скачать",
  config: "Конфигурация",
  items: "Отдельные ответы",
  data: "Снимок датасета",
  aggregate: "Агрегаты",
  created: "Опубликован {date}",
  protocol: "Протокол",
  revision: "Ревизия датасета",
  integrity: "Целостность файлов · SHA-256",
  audit:
    "Скачайте каталог артефактов целиком, чтобы проверить хеши и независимо пересчитать метрики через CLI.",
  missing: "Этот выпуск не опубликован.",
} as const satisfies Dictionary<typeof en>;
