import type { Aggregate } from "@llang-gap/contracts";

const providerLogos: Record<Aggregate["provider"], string | null> = {
  openai: "/providers/openai.svg",
  anthropic: "/providers/anthropic.svg",
  fake: null,
};

export function ProviderLogo({
  provider,
  size = 24,
}: {
  provider: Aggregate["provider"];
  size?: number;
}) {
  const src = providerLogos[provider];
  return src ? (
    <img src={src} width={size} height={size} alt="" className="shrink-0 dark:invert" />
  ) : null;
}
