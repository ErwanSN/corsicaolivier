import { Button } from "../../../components/ui/Button";

export type AuthWelcomeActionsProps = Readonly<{
  onCreateAccount: () => void;
  onLogin: () => void;
}>;

export function AuthWelcomeActions({ onCreateAccount, onLogin }: AuthWelcomeActionsProps) {
  return (
    <div className="grid w-full gap-3">
      <Button label="Créer un compte" onClick={onCreateAccount} size="large" variant="secondary" />
      <Button label="Se connecter" onClick={onLogin} size="large" variant="primary" />
    </div>
  );
}
