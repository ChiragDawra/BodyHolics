import { strings } from "@/lib/strings";

export const metadata = { title: strings.admin.title };

export default function AdminPage() {
  return (
    <main className="p-8">
      <h1 className="font-display text-2xl font-bold text-ink">
        {strings.admin.title}
      </h1>
    </main>
  );
}
