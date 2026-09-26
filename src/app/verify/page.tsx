import type { Metadata } from "next";
import { VerifyShell } from "@/components/VerifyShell";
import { VerifyForm } from "./VerifyForm";

export const metadata: Metadata = { title: "Verify a medicine" };

export default function VerifyIndex() {
  return (
    <VerifyShell>
      <section className="card" style={{ textAlign: "center" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 26 }}>Is my medicine genuine?</h1>
        <p className="card-sub">Scan the QR code on the box with your phone camera, or type the serial below.</p>
        <VerifyForm />
      </section>
    </VerifyShell>
  );
}
