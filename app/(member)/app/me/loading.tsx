import { Skeleton } from "@/components/ui/Skeleton";

export default function MemberMeLoading() {
  return (
    <div className="space-y-4 px-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <Skeleton className="h-9 w-20" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
      <Skeleton className="h-11 w-full rounded-md" />
    </div>
  );
}
