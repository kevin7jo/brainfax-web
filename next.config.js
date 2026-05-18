/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // viem/ox deep generic types in wallet SDK deps (빌드 산출물에는 영향 없음)
    ignoreBuildErrors: true,
  },
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
};
module.exports = nextConfig;
