import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  images: {
    localPatterns: [
      {
        pathname: "/api/media/products/**",
      },
      {
        pathname: "/authentication-img.jpeg",
      },
      {
        pathname: "/logo-noBG.png",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/dashboard/default",
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
