import { ImageResponse } from "next/og";
import { OgMark } from "@/components/og-mark";

// Default social share card for the whole site (Feature: shareability). Applies
// to every route unless a segment provides its own opengraph-image. Rendered
// with next/og so it stays on-brand and needs no binary asset in the repo.
export const alt =
  "InsiderClusters — real-time alerts when multiple insiders buy the same stock";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background:
            "radial-gradient(1100px 500px at 78% -8%, rgba(16,185,129,0.22), transparent), #0a0a0c",
          color: "#f5f5f7",
          fontFamily: "sans-serif",
        }}
      >
        {/* wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <OgMark size={42} color="#ffffff" />
          </div>
          <div style={{ fontSize: 34, fontWeight: 600 }}>InsiderClusters</div>
        </div>

        {/* headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              fontSize: 74,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.05,
              maxWidth: 960,
            }}
          >
            <span>Catch insider conviction the moment it&nbsp;</span>
            <span style={{ color: "#34d399" }}>clusters.</span>
          </div>
          <div style={{ fontSize: 30, color: "#9a9aa6", maxWidth: 880, lineHeight: 1.35 }}>
            Real-time alerts when 2+ insiders buy the same stock around the same
            time — parsed straight from SEC Form 4 filings.
          </div>
        </div>

        {/* footer chips */}
        <div style={{ display: "flex", gap: 14 }}>
          {["2+ insiders", "Open-market buys", "Any market cap", "SEC EDGAR"].map(
            (chip) => (
              <div
                key={chip}
                style={{
                  fontSize: 24,
                  color: "#c7f9e5",
                  border: "1px solid rgba(16,185,129,0.4)",
                  background: "rgba(16,185,129,0.10)",
                  borderRadius: 999,
                  padding: "8px 20px",
                  display: "flex",
                }}
              >
                {chip}
              </div>
            )
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
