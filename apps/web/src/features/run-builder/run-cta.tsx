import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import styles from "./run-cta.module.css";

export async function RunCta() {
  const t = await getTranslations("RunBuilder");
  return (
    <section className={styles.cta} aria-labelledby="own-run-title">
      <div>
        <h2 id="own-run-title">{t("ctaTitle")}</h2>
        <p>{t("ctaBody")}</p>
      </div>
      <Link href="/run" className={styles.ctaAction}>
        {t("ctaAction")}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </section>
  );
}
