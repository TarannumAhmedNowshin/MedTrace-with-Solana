import type { Metadata } from "next";
import { Suspense } from "react";
import { RegulatorScreen } from "@/features/regulator/RegulatorScreen";

export const metadata: Metadata = { title: "Regulator" };

export default function Page() {
  // Suspense boundary required because the screen reads useSearchParams()
  return (
    <Suspense>
      <RegulatorScreen />
    </Suspense>
  );
}
