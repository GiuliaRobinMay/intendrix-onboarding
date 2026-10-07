/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        // The team's own page is made to live inside the community, so
        // it must say out loud that it may be framed.
        source: "/journey/:token",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        // Everything else refuses to be framed — but the rule has to
        // skip the journey page by hand. Next applies every matching
        // rule, so a catch-all here put X-Frame-Options: SAMEORIGIN on
        // the one page that must not have it, and a browser honouring
        // that header blocks the embed whatever the policy above says.
        source: "/:path((?!journey/).*)",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

export default nextConfig;
