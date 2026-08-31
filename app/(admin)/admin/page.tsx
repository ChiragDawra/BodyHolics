import { redirect } from "next/navigation";
import { getUser, isStaff } from "@/lib/supabase/auth";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.admin.title };

export default async function AdminPage() {
  // Middleware only checks that a session exists. Staff membership is verified
  // here, server-side, on every request.
  const user = await getUser();
  if (!user) redirect("/admin/login");
  if (!(await isStaff())) redirect("/admin/login");

  redirect("/admin/members");
}
