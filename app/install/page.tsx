import { InstallGuide } from "@/components/InstallGuide";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.install.title };

export default function InstallPage() {
  return <InstallGuide />;
}
