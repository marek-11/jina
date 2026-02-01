{
type: "file_change",
fileName: "jina-main (1)/jina-main/next.config.js",
oldContent: `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: true
  }
};

module.exports = nextConfig;`,
newContent: `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
};

module.exports = nextConfig;`
}
