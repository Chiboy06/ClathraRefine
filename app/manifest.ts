import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ClathraRefine",
    short_name: "ClathraRefine",
    description: "Hazard prediction and gas leak prevention with carbon capture.",
    start_url: "/app",
    display: "standalone",
    background_color: "#090E1A",
    theme_color: "#0B1222",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
