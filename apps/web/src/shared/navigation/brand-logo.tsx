export function BrandLogo({ compactOnMobile = false }: { compactOnMobile?: boolean }) {
  return (
    <picture className={compactOnMobile ? "brand-logo brand-logo-responsive" : "brand-logo"}>
      {compactOnMobile && (
        <source
          media="(max-width: 480px)"
          srcSet="/brand/llang-gap-mark-black.svg"
          width={512}
          height={512}
        />
      )}
      <img src="/brand/llang-gap-logo-black.svg" width={1284} height={308} alt="" />
    </picture>
  );
}
