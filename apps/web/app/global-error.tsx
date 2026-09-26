"use client";

/** Last-resort boundary when the root layout itself fails; it can't rely on the app's CSS. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#071024", color: "#e8edf8", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 420, padding: 20, textAlign: "center" }}>
          <h1 style={{ fontSize: 32, margin: 0 }}>Recur couldn't load</h1>
          <p style={{ color: "#8b9ac0", lineHeight: 1.6 }}>Nothing was sent from your wallet. Reload the page, or open it in a private window if a browser extension is interfering.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 999, border: 0, background: "#e8edf8", color: "#071024", fontSize: 14, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
