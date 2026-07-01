import { ImageResponse } from "next/og";
import { OgMark } from "@/components/og-mark";

// Apple touch icon (180×180). Filled emerald tile — iOS ignores transparency
// and adds its own rounding, so we render a solid background with the mark.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(150deg, #10b981 0%, #047857 100%)",
        }}
      >
        <OgMark size={120} color="#ffffff" />
      </div>
    ),
    { ...size }
  );
}
