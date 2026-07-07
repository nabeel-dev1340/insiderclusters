import type { MetadataRoute } from "next";

// Web app manifest — gives Android/Chrome and other platforms a name, colors,
// and icon set for install/home-screen and tab theming.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "InsiderClusters",
    short_name: "InsiderClusters",
    description:
      "Real-time alerts when multiple insiders buy the same stock, sourced from SEC Form 4 filings.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0c",
    theme_color: "#059669",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180" },
    ],
  };
}
