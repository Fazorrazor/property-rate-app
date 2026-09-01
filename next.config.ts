import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/welcome",
        destination: "/auth/welcome",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
