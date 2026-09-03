import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTabBar } from "@/components/admin/AdminTabBar";
import { createClient } from "@/lib/supabase/server";
import { getUser, isStaff } from "@/lib/supabase/auth";
import { strings } from "@/lib/strings";

export const metadata = {
  title: { default: strings.admin.title, template: `%s · ${strings.app.name}` },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Guards the whole dashboard.
 *
 * /admin/login deliberately lives in a separate route group, (admin-auth), so
 * it does not inherit this layout — a layout cannot opt one of its own
 * children out of its guard without a redirect loop.
 *
 * Note this checks `is_staff()`, not the admin email list. Routing by email in
 * middleware is a convenience; being on the staff table is the authorisation.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/admin/login");
  if (!(await isStaff())) redirect("/admin/login");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  // The owner gives the desk a number like everyone else.
  if (!profile?.phone) redirect("/app/complete-profile");

  return (
    <div className="flex min-h-dvh bg-surface">
      <AdminSidebar name={profile.full_name} email={user.email ?? null} />
      <div className="min-w-0 flex-1">
        {/*
          No max-width. The dashboard is a laptop tool and the tables on it
          have real columns to spend width on — capping the content at 72rem
          left a third of a wide screen empty while the member list truncated
          emails. Padding steps up instead, so the content breathes at 1920
          without being flung to the far edges.

          Phone layout is everything below sm (640px), which is where the
          sidebar gives way to the tab bar. The extra bottom padding is for
          that bar; from sm up there is nothing floating over the content.
        */}
        <main className="w-full px-5 pb-32 pt-6 sm:px-8 sm:pb-10 sm:pt-8 xl:px-10 2xl:px-14">
          {children}
        </main>
      </div>
      <AdminTabBar />
    </div>
  );
}
