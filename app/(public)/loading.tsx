import { Skeleton } from "@/components/ui/Skeleton";

export default function PublicLoading() {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-5 pt-[calc(3rem+env(safe-area-inset-top))]">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-14 w-full rounded-md" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}
