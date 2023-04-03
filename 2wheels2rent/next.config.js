/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  i18n: {
    locales: ["fr", "en"],
    defaultLocale: "fr",
  },
  // authorise ipfs.io to be used as an image source
  images: {
    domains: ["ipfs.io"],
  },
  async rewrites() {
    return {
      fallback: [{ source: "/api/:path*", destination: "/404" }],
    };
  },
};

module.exports = nextConfig;
