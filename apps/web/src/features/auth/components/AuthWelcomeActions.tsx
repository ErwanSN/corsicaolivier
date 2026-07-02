import { Button } from "../../../components/ui/Button";
import styles from "./AuthWelcomeActions.module.css";

export type AuthWelcomeActionsProps = Readonly<{
  onCreateAccount: () => void;
  onLogin: () => void;
}>;

export function AuthWelcomeActions({ onCreateAccount, onLogin }: AuthWelcomeActionsProps) {
  return (
    <div className={styles.actions}>
      <Button label="Créer un compte" onClick={onCreateAccount} size="large" variant="secondary" />
      <Button label="Se connecter" onClick={onLogin} size="large" variant="primary" />
    </div>
  );
}
