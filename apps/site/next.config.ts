import type { NextConfig } from "next";

// Served by Netlify's Next.js runtime: the pages are prerendered (listings refresh every minute),
// and one API route (/api/conversations/[id]) reads a call's result from Supabase. The site
// needs no secrets: it only uses Supabase's publishable key.
const securityHeaders = [
  // The call widget needs the microphone on our own origin; nothing else does.
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=()" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  // packages/shared ships TypeScript source; compile it as part of this app.
  transpilePackages: ["@leaseline/shared"],
  // Set in Next.js rather than netlify.toml: Netlify's [[headers]] only reach static files, and
  // /team and the API route are server-rendered.
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/team",
        headers: [
          { key: "X-Robots-Tag", value: "noindex" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
