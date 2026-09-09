import { ButtonLink } from "@/shared/links/link";
import { getMessagesForLocale } from "@/i18n/messages";
import type { Locale } from "@/i18n/routing";

export function NotFoundContent({ locale }: { locale: Locale }) {
  const messages = getMessagesForLocale(locale).NotFound;

  return (
    <section className="flex min-h-[min(65svh,42rem)] flex-col items-center justify-center py-20 text-center">
      <title>{`${messages.metadataTitle} · Lang Gap`}</title>
      <h1 className="text-4xl font-semibold sm:text-5xl">{messages.title}</h1>
      <p className="mt-5 max-w-md whitespace-pre-line text-base leading-7 text-muted-foreground sm:text-lg">
        {messages.description}
      </p>
      <ButtonLink href="/" locale={locale} size="lg" direction="forward" className="mt-8">
        {messages.compareModels}
      </ButtonLink>
    </section>
  );
}
