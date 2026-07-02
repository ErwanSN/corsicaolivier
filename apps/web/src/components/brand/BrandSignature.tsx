import { webBrandImages } from "../../assets/brand-images";
import styles from "./BrandSignature.module.css";

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
        className={styles.emblem}
        decoding="async"
        src={webBrandImages.logoSymbolDark.source.src}
      />
    );
  }

  return (
    <div aria-label="Corsica Linea" className={styles.header} role="img">
      <img
        alt=""
        aria-hidden="true"
        className={styles.headerMark}
        decoding="async"
        src={webBrandImages.logoSymbolWhite.source.src}
      />
      <span className={styles.headerText}>CORSICA linea</span>
    </div>
  );
}
