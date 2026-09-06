import type { englishMessages } from "./messages";
import type { Dictionary, Locale as SupportedLocale } from "./routing";

declare module "next-intl" {
  interface AppConfig {
    Locale: SupportedLocale;
    Messages: Dictionary<typeof englishMessages>;
  }
}
