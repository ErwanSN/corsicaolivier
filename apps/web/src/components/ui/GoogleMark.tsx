import { webIdentityImages } from "../../assets/identity-images";
import styles from "./GoogleMark.module.css";

export function GoogleMark() {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={styles.mark}
      decoding="async"
      src={webIdentityImages.googleMark.source.src}
    />
  );
}
