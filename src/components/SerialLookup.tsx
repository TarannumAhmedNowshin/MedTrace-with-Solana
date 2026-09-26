"use client";
import { useEffect, useState, type FormEvent } from "react";
import { isValidSerial, normalizeSerial } from "@/lib/medtrace/serial";

export function SerialLookup({ value, onSubmit, label = "Look up a pack" }: { value?: string; onSubmit: (serial: string) => void; label?: string }) {
  const [draft, setDraft] = useState(value ?? "");
  const [touched, setTouched] = useState(false);
  useEffect(() => setDraft(value ?? ""), [value]);

  const invalid = touched && !!draft && !isValidSerial(draft);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (isValidSerial(draft)) onSubmit(normalizeSerial(draft));
  };

  return (
    <form onSubmit={submit} className="field" style={{ marginBottom: 0 }}>
      <label htmlFor="serial-lookup">{label}</label>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <input
          id="serial-lookup"
          className="input mono"
          placeholder="SQ-000123"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-invalid={invalid}
          autoComplete="off"
          spellCheck={false}
        />
        <button className="btn btn-ghost" type="submit">Find</button>
      </div>
      {invalid && <span className="field-error">Serial must look like SQ-000123</span>}
    </form>
  );
}
