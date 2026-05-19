import { RequireAuth } from "@/app/components/auth-guard";
import { SettingsHub } from "@/app/components/settings-hub";
import { SiteHeader } from "@/app/components/site-header";

export default function Page() {
  return (
    <RequireAuth>
      <div className="page-frame">
        <SiteHeader mode="app" active="settings" />

        <main className="settings-page">
          <div className="settings-shell">
            <SettingsHub />
          </div>
        </main>
      </div>
    </RequireAuth>
  );
}
