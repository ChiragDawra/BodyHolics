import { strings } from "@/lib/strings";

export default function MemberHomePage() {
  return (
    <main>
      <h1>{strings.member.title}</h1>
      <p>{strings.member.intro}</p>
    </main>
  );
}
