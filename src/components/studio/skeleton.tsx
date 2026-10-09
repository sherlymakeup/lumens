import { Skeleton } from "@/components/ui/skeleton";
import { LumenMark } from "./mark";


export function MessageSkeleton() {
  return (
    <div className="space-y-3 py-4" aria-hidden>
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-4 w-[92%]" />
      <Skeleton className="h-4 w-[78%]" />
      <Skeleton className="h-4 w-[64%]" />
    </div>
  );
}
