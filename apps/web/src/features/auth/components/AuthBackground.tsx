import { webBrandImages } from "../../../assets/brand-images";

export function AuthBackground() {
  return (
    <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden bg-surface-inverse">
      <picture className="block h-full w-full">
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
          className="h-full w-full object-cover object-center"
          decoding="async"
          fetchPriority="high"
          src={webBrandImages.authBackgroundMobile.source.src}
        />
      </picture>
    </div>
  );
}
