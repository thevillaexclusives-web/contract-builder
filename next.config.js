/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb', // For large contract JSON
    },
  },
  // Explicitly use webpack (not turbopack) to avoid build issues
  turbopack: {},
  webpack: (config, { isServer }) => {
    // Disable canvas for browser (not needed for PDF generation)
    config.resolve.alias.canvas = false;
    
    if (isServer) {
      // Externalize PDFMake on server to avoid bundling issues
      config.externals = config.externals || [];
      config.externals.push({
        'pdfmake': 'commonjs pdfmake',
      });
    }
    
    return config;
  },
}

module.exports = nextConfig
