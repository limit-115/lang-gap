import { notFound } from "next/navigation";
import { SiteFooter } from "@/shared/navigation/site-footer";

export const metadata = { robots: { index: false, follow: false } };

export default function FooterPreview() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <div className="py-12">
      <h1 className="mb-12 text-2xl font-semibold">Варианты футера</h1>
      {(
        [
          ["paired", "1. GitHub рядом с Navigation"],
          ["spread", "2. GitHub в центре"],
          ["compact", "3. Навигация в строку"],
        ] as const
      ).map(([variant, title]) => (
        <section key={variant} className="mb-10">
          <h2 className="text-base font-medium">{title}</h2>
          <SiteFooter variant={variant} />
        </section>
      ))}
    </div>
  );
}
