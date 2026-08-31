import { strings } from "@/lib/strings";

export const metadata = { title: strings.admin.members.title };

export default function AdminMembersPage() {
  return (
    <h1 className="font-display text-2xl font-bold text-ink">
      {strings.admin.members.title}
    </h1>
  );
}
