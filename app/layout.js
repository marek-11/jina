export const metadata = {
  title: "Jina Reader App",
  description: "Simple webapp for Jina AI Reader"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
