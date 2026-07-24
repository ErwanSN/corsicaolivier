import { AnnouncementBar } from "../../components/layout/AnnouncementBar";
import { AppHeader } from "../../components/layout/AppHeader";
import { MobileBottomNav } from "../../components/layout/MobileBottomNav";
import { SiteFooter } from "../../components/layout/SiteFooter";

export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AnnouncementBar />
      <AppHeader />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
      <MobileBottomNav />
    </>
  );
}
