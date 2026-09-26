import type { Metadata } from "next";
import { Suspense } from "react";
import { QrSheetScreen } from "@/features/qr/QrSheetScreen";

export const metadata: Metadata = { title: "QR labels" };

export default function Page() {
  // Suspense boundary required because the screen reads useSearchParams()
  return (
    <Suspense>
      <QrSheetScreen />
    </Suspense>
  );
}
