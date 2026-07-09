import { AnnouncementBar } from "../../components/layout/AnnouncementBar";
import { AppHeader } from "../../components/layout/AppHeader";
import { MobileBottomNav } from "../../components/layout/MobileBottomNav";

export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AnnouncementBar />
      <AppHeader />
      <main>{children}</main>
      <MobileBottomNav />
    </>
  );
}
