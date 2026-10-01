import type { NextConfig } from "next";

// The leasing team's dashboard (app.tryleaseline.com). Server-rendered; all data access goes
// through the signed-in user's Supabase session, so row-level security decides what they see.
const nextConfig: NextConfig = {
  transpilePackages: ["@leaseline/shared"],
};

export default nextConfig;
