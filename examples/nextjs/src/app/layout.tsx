import { SseProvider } from "pg-sse/client";
import "./globals.css";

export const metadata = {
  title: "pg-sse Live Real-Time Dashboard",
  description:
    "Zero-dependency real-time PostgreSQL subscriptions for Next.js & React",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SseProvider endpoint="/api/sse">{children}</SseProvider>
      </body>
    </html>
  );
}
