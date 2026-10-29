import { PageSkeleton } from "@/components/page-skeleton";

// Its own shape, so this page no longer shows the Leads skeleton while it loads.
export default function Loading() {
  return <PageSkeleton />;
}
