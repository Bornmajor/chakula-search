const host = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : 'localhost';

/** @type {import('next').NextConfig} */
export default {
  images: {
    // Lets next/image optimise photos served from the Supabase storage bucket.
    remotePatterns: [{ protocol: 'https', hostname: host, pathname: '/storage/v1/object/public/**' }],
  },
};
