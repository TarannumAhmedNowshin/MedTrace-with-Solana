"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { isValidSerial, normalizeSerial } from "@/lib/medtrace/serial";

export function VerifyForm() {
  const router = useRouter();
  const [serial, setSerial] = useState("");
  const [error, setError] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidSerial(serial)) return setError(true);
    router.push(`/verify/${encodeURIComponent(normalizeSerial(serial))}`);
  };
  return (
    <form onSubmit={submit} className="stack" style={{ textAlign: "left" }}>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor="v-serial">Serial number</label>
        <input id="v-serial" className="input mono" style={{ fontSize: 20, minHeight: 56 }} placeholder="SQ-000123" value={serial}
          onChange={(e) => { setSerial(e.target.value); setError(false); }} aria-invalid={error} autoCapitalize="characters" />
        {error && <span className="field-error">Serial must look like SQ-000123</span>}
      </div>
      <button className="btn btn-primary btn-lg btn-block" type="submit">Check this pack</button>
    </form>
  );
}
