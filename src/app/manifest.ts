import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Salon Booking Sri Lanka", short_name: "Salon Booking", start_url: "/", display: "standalone",
    background_color: "#f7f6f3", theme_color: "#111827", lang: "en-LK",
  };
}
