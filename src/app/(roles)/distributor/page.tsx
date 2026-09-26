import type { Metadata } from "next";
import { Suspense } from "react";
import { DistributorScreen } from "@/features/distributor/DistributorScreen";

export const metadata: Metadata = { title: "Distributor" };

export default function Page() {
  // Suspense boundary required because the screen reads useSearchParams()
  return (
    <Suspense>
      <DistributorScreen />
    </Suspense>
  );
}
