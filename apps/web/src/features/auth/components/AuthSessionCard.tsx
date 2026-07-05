import { type AuthSessionDto } from "@corsica/contracts";

import { BrandSignature } from "../../../components/brand/BrandSignature";
import { Button } from "../../../components/ui/Button";
import styles from "./AuthSessionCard.module.css";

export type AuthSessionCardProps = Readonly<{
  onLogout: () => void;
  session: AuthSessionDto;
}>;

export function AuthSessionCard({ onLogout, session }: AuthSessionCardProps) {
  return (
    <section aria-labelledby="auth-session-title" className={styles.card}>
      <BrandSignature variant="emblem" />
      <h2 className={styles.title} id="auth-session-title">
        Bienvenue
      </h2>
      <p className={styles.email}>{session.user.email}</p>
      <Button label="Se déconnecter" onClick={onLogout} variant="primary" />
    </section>
  );
}
