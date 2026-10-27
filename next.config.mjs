/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
    // pdfmake (agreement PDFs) loads pdfkit and fontkit with require() at runtime;
    // leave them to Node instead of webpack.
    serverComponentsExternalPackages: ["pdfmake"],
  },
};

export default nextConfig;
