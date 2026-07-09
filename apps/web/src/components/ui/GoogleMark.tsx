import { webIdentityImages } from "../../assets/identity-images";

export function GoogleMark() {
  return (
    <img
      alt=""
      aria-hidden="true"
      className="h-[18px] w-[18px] object-contain"
      decoding="async"
      src={webIdentityImages.googleMark.source.src}
    />
  );
}
