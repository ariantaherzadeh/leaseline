import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// Local dev: share the repo-root .env (ELEVENLABS_API_KEY) with the Python CLI.
// On Netlify the key comes from the site's environment variables instead.
if (existsSync("../../.env")) process.loadEnvFile("../../.env");

// Served by Netlify's Next.js runtime: the pages are prerendered, and one API route
// (/api/conversations/[id]) runs server-side so the ElevenLabs API key stays off the client.
const nextConfig: NextConfig = {
  // packages/shared ships TypeScript source; compile it as part of this app.
  transpilePackages: ["@leaseline/shared"],
};

export default nextConfig;
