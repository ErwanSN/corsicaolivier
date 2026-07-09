import { ConnectionIndicator } from "../../features/staff/ConnectionIndicator";
import { Logo } from "./Logo";

export function StaffTopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between pl-4 pr-5">
        <Logo />
        <ConnectionIndicator />
      </div>
    </header>
  );
}
