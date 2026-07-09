import { type AuthSessionDto } from "@corsica/contracts";

import { BrandSignature } from "../../../components/brand/BrandSignature";
import { Button } from "../../../components/ui/Button";

export type AuthSessionCardProps = Readonly<{
  onLogout: () => void;
  session: AuthSessionDto;
}>;

export function AuthSessionCard({ onLogout, session }: AuthSessionCardProps) {
  return (
    <section
      aria-labelledby="auth-session-title"
      className="grid w-full items-center justify-items-center gap-4 rounded-[28px] border border-border bg-surface px-9 py-8"
    >
      <BrandSignature variant="emblem" />
      <h2 className="text-[18px] font-semibold leading-6 text-foreground" id="auth-session-title">
        Bienvenue
      </h2>
      <p className="text-center text-[14px] font-medium leading-[18px] text-foreground [overflow-wrap:anywhere]">
        {session.user.email}
      </p>
      <Button label="Se déconnecter" onClick={onLogout} variant="primary" />
    </section>
  );
}
