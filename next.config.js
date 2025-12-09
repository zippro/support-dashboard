/** @type {import("next").NextConfig} */
const nextConfig = {
    generateBuildId: async () => {
        return `build-${Date.now()}`
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'jpxkomdyuvouijhvbibq.supabase.co',
                pathname: '/storage/**',
            },
        ],
    },
    headers: async () => {
        return [
            {
                source: '/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
                    },
                    {
                        key: 'Pragma',
                        value: 'no-cache',
                    },
                    {
                        key: 'Expires',
                        value: '0',
                    },
                ],
            },
        ];
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
};
module.exports = nextConfig;
