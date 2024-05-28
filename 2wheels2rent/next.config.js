const ContentSecurityPolicy = `
  default-src 'self' vercel.live;
  script-src 'self' 'unsafe-eval' 'unsafe-inline' cdn.vercel-insights.com vercel.live;
  style-src 'self' 'unsafe-inline' cdnjs.cloudflare.com;
  img-src * blob: data: a.tile.openstreetmap.org b.tile.openstreetmap.org c.tile.openstreetmap.org ipfs.io cloudflare-ipfs.com i.seadn.io s.seadn.io;
  media-src 'none';
  connect-src * api.coingecko.com tile.openstreetmap.org nominatim.openstreetmap.org m.youtube.com verify.walletconnect.com explorer-api.walletconnect.com relay.walletconnect.com;
  font-src 'self';
  frame-src 'self' m.youtube.com verify.walletconnect.com explorer-api.walletconnect.com relay.walletconnect.com;
`.replace(/\n/g, "");

const securityHeaders = [
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
  { key: "Referrer-Policy", value: "origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(*), microphone=(), geolocation=(*), interest-cohort=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: false,
  i18n: {
    locales: ["fr", "en"],
    defaultLocale: "fr",
  },
  images: {
    domains: ["ipfs.io", "cloudflare-ipfs.com", "i.seadn.io", "s.seadn.io"],
  },
  async rewrites() {
    return {
      fallback: [{ source: "/api/:path*", destination: "/404" }],
    };
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
