import { StaffBottomNav } from "../../../components/layout/StaffBottomNav";
import { StaffTopBar } from "../../../components/layout/StaffTopBar";

export default function SalarieTabsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <StaffTopBar />
      <main className="flex-1 pb-24" id="main-content" tabIndex={-1}>
        {children}
      </main>
      <StaffBottomNav />
    </div>
  );
}
