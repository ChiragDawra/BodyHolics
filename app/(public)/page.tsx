import { strings } from "@/lib/strings";

export default function LandingPage() {
  return (
    <main>
      <h1>{strings.landing.title}</h1>
      <p>{strings.landing.tagline}</p>
    </main>
  );
}
