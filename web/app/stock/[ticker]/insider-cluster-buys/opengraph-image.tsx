import { ImageResponse } from "next/og";
import { getTickerPage } from "@/lib/clusters";
import { OgMark } from "@/components/og-mark";

// Per-ticker social card so shared links (e.g. "$SOUN insider cluster buys")
// preview with the real ticker, issuer, and cluster counts — far more clickable
// than a generic image. Falls back gracefully if the DB is unavailable.
export const alt = "Insider cluster buys";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();

  let issuer = "";
  let insiders = 0;
  let clusters = 0;
  try {
    const data = await getTickerPage(symbol, null);
    if (data) {
      issuer = data.issuerName;
      insiders = data.insiderCount;
      clusters = data.totalClusters;
    }
  } catch {
    // fall back to the symbol-only card
  }

  const stats = [
    `${clusters || "—"} cluster${clusters === 1 ? "" : "s"}`,
    `${insiders || "—"} insiders`,
    "SEC Form 4",
  ];

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background:
          "radial-gradient(1100px 500px at 80% -10%, rgba(16,185,129,0.22), transparent), #f7f6f0",
        color: "#202f28",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 4,
            background: "#234f3d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <OgMark size={38} color="#ffffff" />
        </div>
        <div style={{ fontSize: 30, fontWeight: 600 }}>InsiderClusters</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 30, color: "#c6d7aa", fontWeight: 600 }}>
          Insider cluster buys
        </div>
        <div
          style={{
            fontSize: 150,
            fontWeight: 700,
            letterSpacing: -4,
            lineHeight: 1,
          }}
        >
          {symbol}
        </div>
        {issuer && (
          <div style={{ fontSize: 36, color: "#606c61", maxWidth: 1000 }}>
            {issuer}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 14 }}>
        {stats.map((s) => (
          <div
            key={s}
            style={{
              fontSize: 26,
              color: "#234f3d",
              border: "1px solid rgba(35,79,61,0.25)",
              background: "rgba(35,79,61,0.06)",
              borderRadius: 3,
              padding: "10px 22px",
              display: "flex",
            }}
          >
            {s}
          </div>
        ))}
      </div>
    </div>,
    { ...size },
  );
}
