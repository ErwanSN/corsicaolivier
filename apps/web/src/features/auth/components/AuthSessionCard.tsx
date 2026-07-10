import { BrandSignature } from "../../../components/brand/BrandSignature";
import { Button } from "../../../components/ds/Button";
import { type WebAuthSession } from "../web-auth-session";

export type AuthSessionCardProps = Readonly<{
  onLogout: () => void;
  session: WebAuthSession;
}>;

export function AuthSessionCard({ onLogout, session }: AuthSessionCardProps) {
  return (
    <section
      aria-labelledby="auth-session-title"
      className="grid w-full items-center justify-items-center gap-4 py-2"
    >
      <BrandSignature variant="emblem" />
      <h2 className="text-[18px] font-semibold leading-6 text-foreground" id="auth-session-title">
        Bienvenue
      </h2>
      <p className="text-center text-[14px] font-medium leading-[18px] text-foreground [overflow-wrap:anywhere]">
        {session.user.email}
      </p>
      <Button onClick={onLogout} variant="primary">
        Se déconnecter
      </Button>
    </section>
  );
}
