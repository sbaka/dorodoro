import { RequireAuth } from "@/app/components/auth-guard";
import { DashboardView } from "@/app/components/dashboard-view";
import { SiteHeader } from "@/app/components/site-header";

export default function Page() {
  return (
    <RequireAuth>
      <div className="page-frame">
        <SiteHeader mode="app" active="home" />
        <main className="dashboard-page">
          <DashboardView />
        </main>
      </div>
    </RequireAuth>
  );
}
