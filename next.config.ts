import type { NextConfig } from "next";

// `npm run build:mobile` sets this to produce a static copy of the site
// that the iOS/Android apps load from disk (Capacitor `webDir: "out"`).
const isMobileBuild = process.env.MOBILE_BUILD === "1";

const nextConfig: NextConfig = {
  // Pin the project root so Next.js doesn't pick up the lockfile in the parent folder
  turbopack: {
    root: __dirname,
  },
  // Let phones on the same Wi-Fi use the dev server (http://192.168.x.x:3001)
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  ...(isMobileBuild
    ? {
        output: "export",
        // /today/ -> out/today/index.html, which the native web server can find
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
