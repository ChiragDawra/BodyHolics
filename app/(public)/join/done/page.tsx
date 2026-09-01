import { InstallHandoff } from "@/components/InstallHandoff";
import { strings } from "@/lib/strings";

export const metadata = { title: strings.join.doneTitle };

/** Step 3 of 3. */
export default function JoinDonePage() {
  return <InstallHandoff />;
}
