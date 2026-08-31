import { Skeleton } from "@/components/ui/Skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-3">
        <Skeleton className="h-11 flex-1 rounded-md" />
        <Skeleton className="h-11 w-56 rounded-md" />
      </div>
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  );
}
