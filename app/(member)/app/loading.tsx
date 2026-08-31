import { Skeleton } from "@/components/ui/Skeleton";

/** Mirrors the real home screen's shape so nothing jumps when data lands. */
export default function MemberHomeLoading() {
  return (
    <div className="space-y-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="h-36 w-full rounded-lg" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}
