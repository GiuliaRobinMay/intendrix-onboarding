/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // The team's own page is made to live inside the community, so
        // it must say out loud that it may be framed. Browsers refuse a
        // frame by default once anything sets a policy, and a platform
        // that cannot frame it shows an empty box with no explanation.
        source: "/journey/:token",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        // everything else stays un-frameable: the app itself has no
        // business inside someone else's page
        source: "/:path*",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

export default nextConfig;
