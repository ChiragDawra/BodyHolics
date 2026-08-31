import { Skeleton } from "@/components/ui/Skeleton";

export default function MemberActivityLoading() {
  return (
    <div className="space-y-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <Skeleton className="h-9 w-32" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}
