import type { Metadata } from "next";
import { Suspense } from "react";
import { ManufacturerScreen } from "@/features/manufacturer/ManufacturerScreen";

export const metadata: Metadata = { title: "Manufacturer" };

export default function Page() {
  // Suspense boundary required because the screen reads useSearchParams()
  return (
    <Suspense>
      <ManufacturerScreen />
    </Suspense>
  );
}
