import path from 'path';
import { config } from 'dotenv';

// Load environment variables from root directory
config({ path: path.resolve(process.cwd(), '../../.env') });

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_CRYPTO_SECRET: process.env.NEXT_PUBLIC_CRYPTO_SECRET,
    NEXT_PUBLIC_TOKEN_NAME: process.env.NEXT_PUBLIC_TOKEN_NAME,
    NEXT_PUBLIC_HOST_URL: process.env.NEXT_PUBLIC_HOST_URL,
  },
};

export default nextConfig;
