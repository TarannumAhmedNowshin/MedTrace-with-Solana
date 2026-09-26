import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container page" style={{ textAlign: "center" }}>
      <h1>Page not found</h1>
      <p className="muted">Looking for a medicine? <Link href="/verify">Verify a pack</Link>.</p>
    </main>
  );
}
