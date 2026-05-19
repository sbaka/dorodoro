import { RequireAuth } from "@/app/components/auth-guard";
import { FocusLayout } from "@/app/components/focus-layout";

export default function Page() {
  return (
    <RequireAuth>
      <div className="page-frame focus-page">
        <FocusLayout />
      </div>
    </RequireAuth>
  );
}
