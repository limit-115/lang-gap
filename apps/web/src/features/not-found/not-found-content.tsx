import { cn } from "cn";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { getMessagesForLocale } from "@/i18n/messages";
import type { Locale } from "@/i18n/routing";

export function NotFoundContent({ locale }: { locale: Locale }) {
  const messages = getMessagesForLocale(locale).NotFound;

  return (
    <section className="flex min-h-[min(65svh,42rem)] flex-col items-center justify-center py-20 text-center">
      <title>{`${messages.metadataTitle} · Lang Gap`}</title>
      <h1 className="text-4xl font-semibold sm:text-5xl">{messages.title}</h1>
      <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground sm:text-lg">
        {messages.description}
      </p>
      <Link
        href={`/${locale}/`}
        data-slot="button"
        className={cn(
          buttonVariants({ size: "lg" }),
          "mt-8 h-12 gap-3 rounded-xl bg-foreground px-6 text-base font-semibold text-background hover:bg-foreground/85 motion-reduce:transition-none",
        )}
      >
        {messages.compareModels}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </section>
  );
}
