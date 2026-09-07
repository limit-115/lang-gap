const ownerLogos = new Map([
  ["openai", "/providers/openai.svg"],
  ["anthropic", "/providers/anthropic.svg"],
]);

export function ProviderLogo({ ownerId, size = 24 }: { ownerId: string | null; size?: number }) {
  const src = ownerId === null ? undefined : ownerLogos.get(ownerId);
  return src ? (
    <img src={src} width={size} height={size} alt="" className="shrink-0 dark:invert" />
  ) : null;
}
