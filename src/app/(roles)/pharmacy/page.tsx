import type { Metadata } from "next";
import { Suspense } from "react";
import { PharmacyScreen } from "@/features/pharmacy/PharmacyScreen";

export const metadata: Metadata = { title: "Pharmacy" };

export default function Page() {
  // Suspense boundary required because the screen reads useSearchParams()
  return (
    <Suspense>
      <PharmacyScreen />
    </Suspense>
  );
}
