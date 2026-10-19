"use client";

// Last-resort screen when the root layout itself fails, so it can't rely on app styles.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#faf7ff",
          color: "#1f1633",
          textAlign: "center",
          padding: 24,
        }}>
        <div>
          <div style={{ fontSize: 56 }}>🏠</div>
          <h1 style={{ fontSize: 22, margin: "12px 0 4px" }}>Oops, something broke</h1>
          <p style={{ color: "#6b6480", margin: 0 }}>Your chores and points are safe.</p>
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              padding: "12px 24px",
              border: 0,
              borderRadius: 12,
              background: "#8b5cf6",
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
            }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
