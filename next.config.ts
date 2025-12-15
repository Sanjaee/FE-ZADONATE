import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_WS_HOST: process.env.NEXT_PUBLIC_WS_HOST || "localhost:5000",
  },
  images: {
    domains: [
      "res.cloudinary.com",
      "i.pinimg.com",
      "via.placeholder.com",
      "axiomtrading.sfo3.cdn.digitaloceanspaces.com",
      "localhost",
      "localhost:5000",
      "avatars.githubusercontent.com",
      "lh3.googleusercontent.com", // Google profile pictures
      "googleusercontent.com", // Other Google image domains
    ],
  },
};

export default nextConfig;
