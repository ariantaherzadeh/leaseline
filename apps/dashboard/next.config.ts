import type { NextConfig } from "next";

// The leasing team's dashboard (app.tryleaseline.com). Server-rendered; all data access goes
// through the signed-in user's Supabase session, so row-level security decides what they see.
const nextConfig: NextConfig = {
  transpilePackages: ["@leaseline/shared"],
  // Set in Next.js rather than netlify.toml: Netlify's [[headers]] only reach static files, and
  // every page here is server-rendered.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "microphone=(), camera=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
