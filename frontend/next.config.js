/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone is only for Docker builds — Vercel handles output itself
  ...(process.env.DOCKER_BUILD === "1" && { output: "standalone" }),
};

module.exports = nextConfig;
