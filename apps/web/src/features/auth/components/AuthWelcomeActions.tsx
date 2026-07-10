import { Button } from "../../../components/ds/Button";

export type AuthWelcomeActionsProps = Readonly<{
  onCreateAccount: () => void;
  onLogin: () => void;
}>;

export function AuthWelcomeActions({ onCreateAccount, onLogin }: AuthWelcomeActionsProps) {
  return (
    <div className="grid w-full gap-3">
      <Button className="w-full" onClick={onCreateAccount} size="lg" variant="outline">
        Créer un compte
      </Button>
      <Button className="w-full" onClick={onLogin} size="lg" variant="primary">
        Se connecter
      </Button>
    </div>
  );
}
