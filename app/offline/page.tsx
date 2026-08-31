import { strings } from "@/lib/strings";
import { ErrorState } from "@/components/ui/ErrorState";

export const metadata = { title: strings.common.networkErrorTitle };

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <ErrorState
        title={strings.common.networkErrorTitle}
        body={strings.common.networkErrorBody}
      />
    </main>
  );
}
