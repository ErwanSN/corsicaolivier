import { AccountButton } from "../../features/account/AccountButton";
import { Button } from "../ds/Button";
import { NavBar } from "../ds/NavBar";
import { LanguageSelect } from "./LanguageSelect";
import { Logo } from "./Logo";
import { navItems } from "./nav-items";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-20 max-w-7xl items-center gap-6 px-4 lg:px-8">
        <Logo />

        <div className="mx-auto hidden lg:block">
          <NavBar items={navItems} />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Button className="hidden sm:inline-flex" size="md" variant="primary">
            Nous Contacter
          </Button>
          <LanguageSelect />
          <div className="hidden lg:block">
            <AccountButton />
          </div>
        </div>
      </div>
    </header>
  );
}
