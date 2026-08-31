import { strings } from "@/lib/strings";

export default function AdminPage() {
  return (
    <main>
      <h1>{strings.admin.title}</h1>
      <p>{strings.admin.intro}</p>
    </main>
  );
}
