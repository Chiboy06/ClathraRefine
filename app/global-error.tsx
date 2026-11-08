"use client";

/** Last-resort 500 page when the root layout itself fails. Inline styles because global CSS may not have loaded. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en-GB">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#F1F5F9", color: "#0F172A", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24 }}>
        <main>
          <h1 style={{ fontSize: 40, letterSpacing: "-0.02em", margin: 0 }}>Something went wrong on our side</h1>
          <p style={{ fontSize: 18, color: "#475569", maxWidth: 480, margin: "16px auto" }}>Plant safety is not affected: the edge controller runs on site without this page.</p>
          <button onClick={reset} style={{ minHeight: 44, padding: "0 20px", borderRadius: 999, border: 0, background: "#2563EB", color: "#fff", fontWeight: 600, fontSize: 16, cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
