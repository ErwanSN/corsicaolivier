import { webBrandImages } from "../../assets/brand-images";

type BrandSignatureVariant = "emblem" | "header";

export type BrandSignatureProps = Readonly<{
  variant: BrandSignatureVariant;
}>;

export function BrandSignature({ variant }: BrandSignatureProps) {
  if (variant === "emblem") {
    return (
      <img
        alt=""
        aria-hidden="true"
        className="h-[30px] w-[30px] object-contain [filter:brightness(0)]"
        decoding="async"
        src={webBrandImages.logoSymbolDark.source.src}
      />
    );
  }

  return (
    <div aria-label="Corsica Linea" className="inline-flex items-center gap-2" role="img">
      <img
        alt=""
        aria-hidden="true"
        className="h-[22px] w-[22px]"
        decoding="async"
        src={webBrandImages.logoSymbolWhite.source.src}
      />
      <span className="text-[12px] font-bold leading-[15px] text-background">CORSICA linea</span>
    </div>
  );
}
