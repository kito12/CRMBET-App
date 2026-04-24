/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep puppeteer-core and @sparticuz/chromium out of the bundler so
  // the native binary + heavy internals ship as-is to the Lambda.
  experimental: {
    serverComponentsExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  },
};
module.exports = nextConfig;
