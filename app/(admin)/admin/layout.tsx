import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { SignOutButton } from "@/components/admin/SignOutButton";
import { getUser, isStaff } from "@/lib/supabase/auth";
import { strings } from "@/lib/strings";

export const metadata = {
  title: { default: strings.admin.title, template: `%s · ${strings.app.name}` },
  robots: { index: false, follow: false },
};

/**
 * Guards the whole dashboard.
 *
 * /admin/login deliberately lives in a separate route group, (admin-auth), so
 * it does not inherit this layout — a layout cannot opt one of its own children
 * out of its guard without a redirect loop.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/admin/login");
  if (!(await isStaff())) redirect("/admin/login");

  return (
    <div className="flex min-h-dvh flex-col bg-surface md:flex-row">
      <AdminSidebar />
      <div className="flex-1 overflow-x-hidden">
        <div className="flex items-center justify-end border-b border-border px-6 py-3">
          <SignOutButton label={strings.admin.signOut} fullWidth={false} />
        </div>
        <main className="mx-auto max-w-5xl p-6">{children}</main>
      </div>
    </div>
  );
}
