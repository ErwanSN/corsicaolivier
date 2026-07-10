const development = process.env.NODE_ENV !== "production";
const apiOrigin = originOf(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001");
const contentSecurityPolicy = [
  "base-uri 'self'",
  "child-src 'none'",
  `connect-src 'self' ${apiOrigin}`,
  "default-src 'self'",
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https://*.basemaps.cartocdn.com",
  "manifest-src 'self'",
  "media-src 'self'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:"
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Frame-Options", value: "DENY" },
  ...(development
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload"
        }
      ])
];

/** @type {import("next").NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        headers: securityHeaders,
        source: "/(.*)"
      }
    ];
  },
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true
};

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    throw new Error("NEXT_PUBLIC_API_URL must be an absolute URL.");
  }
}

export default nextConfig;
