import { webBrandImages } from "../../../assets/brand-images";
import styles from "./AuthBackground.module.css";

export function AuthBackground() {
  return (
    <div aria-hidden="true" className={styles.background}>
      <picture className={styles.picture}>
        <source
          media="(min-width: 768px)"
          sizes="100vw"
          srcSet={[
            `${webBrandImages.authBackgroundDesktop1280.source.src} 1280w`,
            `${webBrandImages.authBackgroundDesktop1920.source.src} 1920w`,
            `${webBrandImages.authBackgroundDesktop.source.src} 2560w`
          ].join(", ")}
          type="image/webp"
        />
        <source
          media="(max-width: 767px)"
          sizes="100vw"
          srcSet={[
            `${webBrandImages.authBackgroundMobile540.source.src} 540w`,
            `${webBrandImages.authBackgroundMobile720.source.src} 720w`,
            `${webBrandImages.authBackgroundMobile.source.src} 1080w`
          ].join(", ")}
          type="image/webp"
        />
        <img
          alt=""
          className={styles.image}
          decoding="async"
          fetchPriority="high"
          src={webBrandImages.authBackgroundMobile.source.src}
        />
      </picture>
    </div>
  );
}
